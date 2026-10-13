import fs from 'node:fs';
import {Config} from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setCodec('h264');
Config.setCrf(15);
Config.setPixelFormat('yuv420p');
Config.setAudioCodec('aac');
Config.setAudioBitrate('256k');
Config.setConcurrency(4);
Config.setChromiumOpenGlRenderer('swangle');

// Cloud sandbox: reuse the pre-installed headless shell instead of downloading one.
// On a normal machine this path does not exist and Remotion uses its own browser.
const sandboxShell = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';
if (fs.existsSync(sandboxShell)) {
	Config.setBrowserExecutable(sandboxShell);
}
