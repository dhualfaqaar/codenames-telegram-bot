' Runs the Codenames Telegram Bot hidden (no console window).
' Double-click this file to start the bot in the background.
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Ahmed\Desktop\codenames"
WshShell.Run """C:\Users\Ahmed\Desktop\codenames\start-bot.bat""", 0, False
