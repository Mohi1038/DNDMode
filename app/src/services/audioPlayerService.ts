import { NativeModules } from 'react-native';

const { AudioPlayerModule } = NativeModules;

class AudioPlayerService {
    async playFromUrl(url: string): Promise<void> {
        try {
            console.log('[AudioPlayer] Playing:', url);
            await AudioPlayerModule.playFromUrl(url);
            console.log('[AudioPlayer] Playback started');
        } catch (error) {
            console.error('[AudioPlayer] Play failed:', error);
            throw error;
        }
    }

    async stop(): Promise<void> {
        try {
            await AudioPlayerModule.stop();
            console.log('[AudioPlayer] Stopped');
        } catch (error) {
            console.error('[AudioPlayer] Stop failed:', error);
        }
    }

    async isPlaying(): Promise<boolean> {
        return await AudioPlayerModule.isPlaying();
    }
}

export const audioPlayerService = new AudioPlayerService();
