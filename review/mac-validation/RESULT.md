# JIXIN — Mac handover verification

2026-11-12, Codex. Result: project transfer verified; Windows VM shut down normally; Mac main interaction flow passed in the Codex in-app browser.

- Independently rehashed 83 previously transferred files and all 13 newly transferred audit/log files. All match. The copy manifest itself has the documented self-reference exception.
- Claude scanned the Windows user profile for project candidates and disclosed 84 legacy-junction/long-path errors plus excluded OS/program directories. No unique project source or output was reported missing. This is a scoped project audit, not proof that every Windows file was scanned.
- VMware Fusion's menu reported Windows is off; vmrun independently reported zero running VMs. A password-protected vmrun shutdown attempt made no change; the normal Fusion Shut Down action succeeded.
- Tested the delivered static ZIP extracted into a temporary Mac directory. Entry, three ring locks, unseal to AWAKE, seed inspection, Escape return, seal back to SEALED all observed. No console errors captured in that tab.
- Safari additionally loaded the scene and passed sound-label toggling; a full Safari animation-cycle pass was not established. The main interaction pass above applies to the Mac in-app browser.
- HUD showed about 60 FPS at internal 1276x1952, Fidelity / 4xMSAA in the in-app browser. This was not a controlled benchmark or a native 4K120 measurement.
- Existing source, video, PDF and delivery ZIPs were not modified. Windows automated results remain separate from this Mac smoke test.

Local preview: http://127.0.0.1:8788/ (Mac only while its temporary HTTP server remains running).
Detailed machine and test records: environment.json and results.json in this folder.
