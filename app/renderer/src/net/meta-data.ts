import exifr from 'exifr';
import mediaInfoFactory from 'mediainfo.js';
import type { MediaInfoResult, Track } from 'mediainfo.js';

type FileProp = {
    file: File;
}

export type ImageMetadata = Record<string, string | number | null>;

export type MediaMetadata = ImageMetadata;

export function getBasicMediaMetadata({ file }: FileProp): Promise<MediaMetadata> {
  if (file.type.startsWith('video/')) {
    return getBasicVideoMetadata(file);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        name: file.name,
        sizeBytes: file.size,
        type: file.type,
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read image dimensions.'));
    };
    img.src = url;
  });
}

function getBasicVideoMetadata(file: File): Promise<MediaMetadata> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve({
        name: file.name,
        sizeBytes: file.size,
        type: file.type,
        width: video.videoWidth,
        height: video.videoHeight,
        durationSeconds: Number(video.duration.toFixed(2))
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Unable to read video metadata.'));
    };
    video.src = url;
  });
}

export async function getDeepImageMetadata({ file }: FileProp): Promise<ImageMetadata> {
  try {
    const metadata = await exifr.parse(file);
    
    if (!metadata) return { message: 'No EXIF data found in this image.' };

    return {
      cameraMake: metadata.Make,
      cameraModel: metadata.Model,
      lensModel: metadata.LensModel,
      dateTaken: metadata.DateTimeOriginal,
      exposureTime: metadata.ExposureTime ? `1/${Math.round(1 / metadata.ExposureTime)}s` : null,
      fNumber: metadata.FNumber ? `f/${metadata.FNumber}` : null,
      iso: metadata.ISO,
      focalLength: metadata.FocalLength ? `${metadata.FocalLength}mm` : null,
      latitude: metadata.latitude,
      longitude: metadata.longitude,
      altitude: metadata.GPSAltitude,
      orientation: metadata.Orientation,
      software: metadata.Software
    };
  } catch (error) {
    console.error("Failed to parse deep metadata:", error);
    throw new Error('Unable to read image metadata.');
  }
}

export async function getDeepVideoMetadata({ file }: FileProp): Promise<MediaMetadata> {
  try {
    const mediaInfo = await mediaInfoFactory();
    const result = await mediaInfo.analyzeData(
      file.size,
      async (size, offset) => new Uint8Array(
        await file.slice(offset, offset + size).arrayBuffer()
      )
    ) as MediaInfoResult;

    const tracks = result.media?.track ?? [];
    const general = tracks.find((track) => track['@type'] === 'General');
    const video = tracks.find((track) => track['@type'] === 'Video');
    const audio = tracks.find((track) => track['@type'] === 'Audio');

    return {
      format: getTrackValue(general, 'Format'),
      formatProfile: getTrackValue(general, 'Format_Profile'),
      duration: getTrackValue(general, 'Duration_String'),
      overallBitRate: getTrackValue(general, 'OverallBitRate_String'),
      encodedDate: getTrackValue(general, 'Encoded_Date'),
      writingApplication: getTrackValue(general, 'Encoded_Application'),
      videoCodec: getTrackValue(video, 'CodecID/String') ?? getTrackValue(video, 'CodecID'),
      videoFormat: getTrackValue(video, 'Format'),
      videoProfile: getTrackValue(video, 'Format_Profile'),
      frameRate: getTrackValue(video, 'FrameRate_String'),
      frameCount: getTrackValue(video, 'FrameCount'),
      scanType: getTrackValue(video, 'ScanType'),
      audioCodec: getTrackValue(audio, 'CodecID/String') ?? getTrackValue(audio, 'CodecID'),
      audioFormat: getTrackValue(audio, 'Format'),
      audioChannels: getTrackValue(audio, 'Channel(s)'),
      audioSamplingRate: getTrackValue(audio, 'SamplingRate_String'),
      audioBitRate: getTrackValue(audio, 'BitRate_String')
    };
  } catch (error) {
    console.error('Failed to parse deep video metadata:', error);
    throw new Error('Unable to read video metadata.');
  }
}

function getTrackValue(
  track: Track | undefined,
  key: string
): string | number | null {
  if (!track) return null;
  const value = Object.entries(track).find(([name]) => name === key)?.[1];
  return typeof value === 'string' || typeof value === 'number' ? value : null;
}
