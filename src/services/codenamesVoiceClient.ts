// Browser-side opt-in peer audio. Signalling is ephemeral; media never traverses the game server.
export const CODENAMES_VOICE_SCRIPT = String.raw`
var codeVoice={session:'',epoch:'',active:false,mic:false,speaker:false,stream:null,silent:null,audioContext:null,peers:{},participants:[],timer:0,busy:false,permissionExplained:false};
function codeVoiceId(){var a=new Uint8Array(16);crypto.getRandomValues(a);return Array.from(a,function(n){return n.toString(16).padStart(2,'0')}).join('')}
function codeVoiceRender(){
  document.querySelectorAll('[data-voice-mic]').forEach(function(b){b.setAttribute('aria-pressed',String(codeVoice.mic));b.title=codeVoice.mic?'كتم المايك':'فتح المايك';b.setAttribute('aria-label',b.title);b.classList.toggle('on',codeVoice.mic)});
  document.querySelectorAll('[data-voice-speaker]').forEach(function(b){b.setAttribute('aria-pressed',String(codeVoice.speaker));b.title=codeVoice.speaker?'كتم السماعة':'فتح السماعة';b.setAttribute('aria-label',b.title);b.classList.toggle('on',codeVoice.speaker)});
  // Room polling also supplies public on/off states to players who keep both
  // devices off; those players do not join the voice signalling session.
  var states=roomData&&roomData.state&&roomData.state.voiceStatus||[];
  document.querySelectorAll('[data-voice-remote]').forEach(function(el){var p=states.find(function(v){return v.seat===Number(el.dataset.voiceRemote)});var m=el.querySelector('[data-peer-mic]'),h=el.querySelector('[data-peer-speaker]');if(m){m.classList.toggle('on',!!(p&&p.mic));m.title=p&&p.mic?'المايك مفتوح':'المايك مكتوم'}if(h){h.classList.toggle('on',!!(p&&p.speaker));h.title=p&&p.speaker?'السماعة مفتوحة':'السماعة مكتومة'}el.setAttribute('aria-label',(p&&p.mic?'المايك مفتوح':'المايك مكتوم')+' · '+(p&&p.speaker?'السماعة مفتوحة':'السماعة مكتومة'))});
  Object.values(codeVoice.peers).forEach(function(p){if(p.audio){p.audio.muted=!codeVoice.speaker;if(codeVoice.speaker)p.audio.play().catch(function(){})}});
}
async function codeVoiceCall(body){
  if(!roomId||!roomToken)throw new Error('الغرفة غير جاهزة');
  var res=await fetch('/api/interactive/rooms/'+encodeURIComponent(roomId)+'/voice',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+roomToken},body:JSON.stringify(Object.assign({session:codeVoice.session},body)),cache:'no-store'});
  var data=await res.json().catch(function(){return {}});if(!res.ok)throw new Error(data.error||'تعذر الاتصال بالصوت');return data;
}
function codeVoiceDropPeer(id){var peer=codeVoice.peers[id];if(!peer)return;delete codeVoice.peers[id];try{peer.pc.close()}catch(e){}if(peer.audio)peer.audio.remove()}
function codeVoiceResetPeers(){Object.keys(codeVoice.peers).forEach(codeVoiceDropPeer)}
function codeVoiceStop(){
  var id=roomId,token=roomToken,session=codeVoice.session;
  codeVoice.active=false;clearTimeout(codeVoice.timer);codeVoice.timer=0;
  if(codeVoice.stream)codeVoice.stream.getTracks().forEach(function(t){t.stop()});
  codeVoice.stream=null;if(codeVoice.silent)codeVoice.silent.getTracks().forEach(function(t){t.stop()});codeVoice.silent=null;if(codeVoice.audioContext)codeVoice.audioContext.close().catch(function(){});codeVoice.audioContext=null;codeVoice.mic=false;codeVoice.speaker=false;codeVoiceResetPeers();codeVoice.participants=[];codeVoice.epoch='';codeVoice.session='';codeVoiceRender();
  if(id&&token&&session)fetch('/api/interactive/rooms/'+encodeURIComponent(id)+'/voice',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({action:'leave',session:session}),keepalive:true}).catch(function(){});
}
async function codeVoiceSignal(id,kind,value){try{await codeVoiceCall({action:'signal',to:id,kind:kind,value:value})}catch(e){}}
function codeVoicePeer(id){
  if(codeVoice.peers[id])return codeVoice.peers[id];
  var pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  var transceiver=null;if(codeVoice.session<id){var initial=codeVoice.stream?codeVoice.stream.getAudioTracks()[0]:codeVoice.silent.getAudioTracks()[0];transceiver=pc.addTransceiver(initial,{direction:'sendrecv',streams:[codeVoice.stream||codeVoice.silent]})}
  var peer={pc:pc,sender:transceiver?transceiver.sender:null,pending:[],audio:null};codeVoice.peers[id]=peer;
  pc.onicecandidate=function(event){if(event.candidate)codeVoiceSignal(id,'candidate',event.candidate.toJSON())};
  pc.ontrack=function(event){if(!codeVoice.active)return;var audio=peer.audio||document.createElement('audio');peer.audio=audio;audio.autoplay=true;audio.muted=!codeVoice.speaker;audio.srcObject=event.streams[0]||new MediaStream([event.track]);if(!audio.isConnected)document.body.appendChild(audio);if(codeVoice.speaker)audio.play().catch(function(){toast('دوس السماعة حتى يشتغل الصوت')})};
  pc.onconnectionstatechange=function(){if(pc.connectionState==='failed'||pc.connectionState==='closed'){codeVoiceDropPeer(id);if(codeVoice.active)toast('تعذر ربط الصوت بأحد اللاعبين؛ الشبكة قد تمنع الاتصال المباشر')}};
  return peer;
}
async function codeVoiceOffer(id){var peer=codeVoicePeer(id);try{var offer=await peer.pc.createOffer();await peer.pc.setLocalDescription(offer);await codeVoiceSignal(id,'offer',peer.pc.localDescription.toJSON())}catch(e){codeVoiceDropPeer(id)}}
async function codeVoiceMessage(message){
  var peer=codeVoicePeer(message.from),pc=peer.pc;
  try{
    if(message.kind==='offer'){
      await pc.setRemoteDescription(message.value);var transceiver=pc.getTransceivers().find(function(t){return t.receiver.track.kind==='audio'});if(!transceiver)throw new Error('audio transceiver missing');transceiver.direction='sendrecv';peer.sender=transceiver.sender;var current=codeVoice.stream||codeVoice.silent;if(peer.sender.setStreams)peer.sender.setStreams(current);await peer.sender.replaceTrack(current.getAudioTracks()[0]);for(var c of peer.pending.splice(0))await pc.addIceCandidate(c);
      await pc.setLocalDescription(await pc.createAnswer());await codeVoiceSignal(message.from,'answer',pc.localDescription.toJSON());
    }else if(message.kind==='answer'){
      if(pc.signalingState!=='have-local-offer')return;await pc.setRemoteDescription(message.value);for(var c of peer.pending.splice(0))await pc.addIceCandidate(c);
    }else if(message.kind==='candidate'){if(pc.remoteDescription)await pc.addIceCandidate(message.value);else peer.pending.push(message.value)}
  }catch(e){codeVoiceDropPeer(message.from)}
}
async function codeVoiceSync(){
  if(!codeVoice.active||codeVoice.busy)return;codeVoice.busy=true;var session=codeVoice.session;
  try{
    var data=await codeVoiceCall({action:'sync',mic:codeVoice.mic,speaker:codeVoice.speaker});
    if(!codeVoice.active||session!==codeVoice.session)return;
    if(codeVoice.epoch&&codeVoice.epoch!==data.epoch)codeVoiceResetPeers();codeVoice.epoch=data.epoch;
    codeVoice.participants=data.participants||[];var others=codeVoice.participants.filter(function(p){return p.session!==session});
    Object.keys(codeVoice.peers).forEach(function(id){if(!others.some(function(p){return p.session===id}))codeVoiceDropPeer(id)});
    for(var p of others)if(!codeVoice.peers[p.session]&&session<p.session)codeVoiceOffer(p.session);
    for(var m of data.messages||[])if(others.some(function(p){return p.session===m.from}))await codeVoiceMessage(m);
    codeVoiceRender();
  }catch(e){if(codeVoice.active)toast('تعذر تحديث اتصال الصوت؛ جرّب مرة ثانية')}
  finally{codeVoice.busy=false;if(codeVoice.active){clearTimeout(codeVoice.timer);codeVoice.timer=setTimeout(codeVoiceSync,session===codeVoice.session?1500:0)}}
}
function codeVoiceStart(){
  if(codeVoice.active)return true;
  if(!window.RTCPeerConnection||!window.crypto||!crypto.getRandomValues){toast('متصفحك ما يدعم الصوت المباشر');return false}
  if(!codeVoice.permissionExplained){if(!confirm('الصوت اتصال مباشر بين لاعبي الغرفة وقد يكشف عنوان الشبكة للاعبين الآخرين. تكمل؟'))return false;codeVoice.permissionExplained=true}
  try{var AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)throw new Error('no audio context');var context=new AudioCtx(),source=context.createOscillator(),gain=context.createGain(),out=context.createMediaStreamDestination();gain.gain.value=0;source.connect(gain);gain.connect(out);source.start();context.resume().catch(function(){});codeVoice.audioContext=context;codeVoice.silent=out.stream}catch(e){toast('متصفحك ما يدعم الصوت المباشر');return false}
  codeVoice.session=codeVoiceId();codeVoice.active=true;return true;
}
async function codeVoiceToggleMic(){
  if(codeVoice.mic){codeVoice.mic=false;if(codeVoice.stream)codeVoice.stream.getTracks().forEach(function(t){t.stop()});codeVoice.stream=null;Object.values(codeVoice.peers).forEach(function(p){if(p.sender)p.sender.replaceTrack(codeVoice.silent.getAudioTracks()[0]).catch(function(){})});if(!codeVoice.speaker)codeVoiceStop();else codeVoiceRender();return}
  if(!codeVoiceStart())return;
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast('المايك مو مدعوم بهالمتصفح');if(!codeVoice.speaker)codeVoiceStop();return}
  try{var session=codeVoice.session,stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(!codeVoice.active||session!==codeVoice.session){stream.getTracks().forEach(function(t){t.stop()});return}codeVoice.stream=stream;codeVoice.mic=true;var track=stream.getAudioTracks()[0];track.onended=function(){if(codeVoice.stream!==stream)return;codeVoice.mic=false;codeVoice.stream=null;if(!codeVoice.speaker){codeVoiceStop();return}Object.values(codeVoice.peers).forEach(function(p){if(p.sender&&codeVoice.silent)p.sender.replaceTrack(codeVoice.silent.getAudioTracks()[0]).catch(function(){})});codeVoiceRender()};await Promise.all(Object.values(codeVoice.peers).map(function(p){return p.sender?p.sender.replaceTrack(track):Promise.resolve()}));codeVoiceRender();codeVoiceSync()}catch(e){toast('ما كدرنا نفتح المايك؛ تأكد من الصلاحية');if(!codeVoice.speaker)codeVoiceStop()}
}
function codeVoiceToggleSpeaker(){
  if(codeVoice.speaker){codeVoice.speaker=false;if(!codeVoice.mic)codeVoiceStop();else codeVoiceRender();return}
  if(!codeVoiceStart())return;codeVoice.speaker=true;codeVoiceRender();codeVoiceSync();
}
window.addEventListener('pagehide',codeVoiceStop);
`;
