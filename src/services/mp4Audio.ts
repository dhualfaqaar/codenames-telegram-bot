/**
 * Extract audio from a non-fragmented ISO BMFF file without re-encoding.
 * Keep box positions and sizes unchanged so the existing stco/co64 offsets
 * remain valid; replace video tracks with free boxes and erase their samples.
 * Unsupported or malformed files are rejected, not returned as fake audio.
 */
interface Box { start: number; end: number; data: number; type: string }
interface Range { start: number; end: number }

export function extractMp4Audio(source: Uint8Array): Uint8Array | null {
  try {
    const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
    const boxes = (start: number, end: number): Box[] | null => {
      const found: Box[] = [];
      for (let pos = start; pos < end;) {
        if (end - pos < 8) return null;
        let size = view.getUint32(pos), header = 8;
        if (size === 1) {
          if (end - pos < 16) return null;
          const wide = view.getBigUint64(pos + 8);
          if (wide > BigInt(Number.MAX_SAFE_INTEGER)) return null;
          size = Number(wide); header = 16;
        } else if (size === 0) size = end - pos;
        if (size < header || size > end - pos) return null;
        const type = String.fromCharCode(...source.subarray(pos + 4, pos + 8));
        found.push({start:pos, end:pos + size, data:pos + header, type});
        pos += size;
      }
      return found;
    };
    const children = (box: Box) => boxes(box.data, box.end);
    const top = boxes(0, source.length);
    if (!top || top[0]?.type !== 'ftyp' || top.filter(box => box.type === 'moov').length !== 1 || top.some(box => box.type === 'moof')) return null;
    const moov = top.find(box => box.type === 'moov');
    const mdats = top.filter(box => box.type === 'mdat');
    if (!moov || !mdats.length) return null;
    const moovChildren = children(moov);
    if (!moovChildren || moovChildren.some(box => box.type === 'mvex')) return null;

    const tracks: Array<{ box: Box; kind: string; mdia: Box }> = [];
    for (const box of moovChildren.filter(item => item.type === 'trak')) {
      const trackChildren = children(box), mdia = trackChildren?.find(item => item.type === 'mdia');
      const mediaChildren = mdia && children(mdia), hdlr = mediaChildren?.find(item => item.type === 'hdlr');
      if (!mdia || !mediaChildren || !hdlr || hdlr.data + 12 > hdlr.end) return null;
      const kind = String.fromCharCode(...source.subarray(hdlr.data + 8, hdlr.data + 12));
      tracks.push({box,kind,mdia});
    }
    if (!tracks.some(track => track.kind === 'soun')) return null;
    const videos = tracks.filter(track => track.kind === 'vide');
    // Already audio-only. Crucial for old drafts incorrectly marked as video:
    // retain the original ftyp, metadata and every byte of the sound file.
    if (!videos.length) return source;

    const samples = (mdia: Box): Range[] | null => {
      const minf = children(mdia)?.find(item => item.type === 'minf');
      const stbl = minf && children(minf)?.find(item => item.type === 'stbl');
      const entries = stbl && children(stbl);
      const stsc = entries?.find(item => item.type === 'stsc');
      const stsz = entries?.find(item => item.type === 'stsz');
      const offsets = entries?.find(item => item.type === 'stco' || item.type === 'co64');
      if (!stsc || !stsz || !offsets || stsc.data + 8 > stsc.end || stsz.data + 12 > stsz.end || offsets.data + 8 > offsets.end) return null;
      const scCount = view.getUint32(stsc.data + 4), sampleSize = view.getUint32(stsz.data + 4);
      const sampleCount = view.getUint32(stsz.data + 8), chunkCount = view.getUint32(offsets.data + 4);
      const stride = offsets.type === 'stco' ? 4 : 8;
      if (!scCount || !sampleCount || !chunkCount || scCount > Math.floor((stsc.end - stsc.data - 8) / 12) ||
          chunkCount > Math.floor((offsets.end - offsets.data - 8) / stride) ||
          (!sampleSize && sampleCount > Math.floor((stsz.end - stsz.data - 12) / 4)) || sampleCount > source.length) return null;
      const mapping: Array<{ first: number; count: number }> = [];
      for (let i = 0; i < scCount; i++) {
        const pos = stsc.data + 8 + i * 12, first = view.getUint32(pos), count = view.getUint32(pos + 4);
        if (!first || !count || first > chunkCount || (i === 0 && first !== 1) || (i > 0 && first <= mapping[i - 1].first)) return null;
        mapping.push({first,count});
      }
      const ranges: Range[] = [];
      let sample = 0, rule = 0;
      for (let chunk = 1; chunk <= chunkCount; chunk++) {
        while (rule + 1 < mapping.length && mapping[rule + 1].first <= chunk) rule++;
        const at = offsets.data + 8 + (chunk - 1) * stride;
        const wide = stride === 8 ? view.getBigUint64(at) : BigInt(view.getUint32(at));
        if (wide > BigInt(Number.MAX_SAFE_INTEGER)) return null;
        const start = Number(wide);
        let length = 0;
        for (let n = 0; n < mapping[rule].count; n++) {
          if (sample >= sampleCount) return null;
          length += sampleSize || view.getUint32(stsz.data + 12 + sample * 4);
          sample++;
        }
        const end = start + length;
        if (!Number.isSafeInteger(end) || !mdats.some(mdat => start >= mdat.data && end <= mdat.end)) return null;
        if (length) ranges.push({start,end});
      }
      return sample === sampleCount ? ranges : null;
    };

    // Never erase an audio or other track sample. Unknown/unsupported sample
    // tables fail closed instead of silently returning a damaged file.
    const videoRanges: Range[] = [], otherRanges: Range[] = [];
    for (const track of tracks) {
      const ranges = samples(track.mdia);
      if (!ranges) return null;
      (track.kind === 'vide' ? videoRanges : otherRanges).push(...ranges);
    }
    otherRanges.sort((a,b) => a.start-b.start);
    const maxEnds: number[] = [];
    for (const range of otherRanges) maxEnds.push(Math.max(maxEnds.at(-1) || 0, range.end));
    for (const range of videoRanges) {
      let low = 0, high = otherRanges.length;
      while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (otherRanges[mid].start < range.end) low = mid + 1;
        else high = mid;
      }
      if (low && maxEnds[low - 1] > range.start) return null;
    }
    const output = Uint8Array.from(source);
    for (const range of videoRanges) output.fill(0,range.start,range.end);
    for (const track of videos) output.set([0x66,0x72,0x65,0x65], track.box.start + 4); // free
    return output;
  } catch {
    return null;
  }
}
