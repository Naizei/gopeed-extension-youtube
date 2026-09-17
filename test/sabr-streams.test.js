import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

test('merged download opens one SABR session carrying both tracks', async () => {
  const source = readFileSync(new URL('../src/lib/sabr/streams.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/^export /gm, '');
  const starts = [];
  let sessions = 0;
  let aborted = 0;
  const video = { itag: 137 };
  const audio = { itag: 140 };
  const videoStream = new ReadableStream();
  const audioStream = new ReadableStream();
  const scope = {
    URL,
    MessageError: Error,
    Constants: { CLIENT_NAME_IDS: { WEB: 1 } },
    Utils: { generateRandomString: () => 'session-cpn' },
    EnabledTrackTypes: { VIDEO_AND_AUDIO: 3, VIDEO_ONLY: 1, AUDIO_ONLY: 2 },
    browserFetch: () => async () => {},
    getBrowserUserAgent: async () => 'browser-ua',
    buildSabrFormat: (format) => format,
    selectVideoFormat: () => video,
    SabrStream: class { selectFormats() { return { videoFormat: video, audioFormat: audio }; } },
    BoundedSabrStream: class {
      constructor() { sessions++; }
      async start(options) { starts.push(options); return { videoStream, audioStream }; }
      abort() { aborted++; }
    },
  };
  vm.runInNewContext(source, scope);
  const prepared = {
    __sabrPrepared: true,
    videoId: 'example',
    yt: {
      session: { context: { client: { clientName: 'WEB', clientVersion: 'test' } }, player: { decipher: async (url) => url } },
      getInfo: async () => ({
        streaming_data: { server_abr_streaming_url: 'https://example.test/sabr', adaptive_formats: [video, audio] },
        player_config: { media_common_config: { media_ustreamer_request_config: { video_playback_ustreamer_config: 'config' } } },
      }),
    },
  };
  const session = await scope.preparePreparedSabrSession(prepared, 'token');
  const streams = await session.openStreams();
  assert.equal(sessions, 1);
  assert.equal(starts.length, 1);
  assert.equal(starts[0].enabledTrackTypes, 3);
  assert.equal(streams.videoStream, videoStream);
  assert.equal(streams.audioStream, audioStream);
  streams.abort();
  assert.equal(aborted, 1);
});
