import mobileDefaultData from '../../content/mobile-default-data.json';

export type MobileVideo = {
  youtubeId: string;
  url: string;
  embedUrl: string;
};

export type MobileDefaultData = {
  curriculum: {
    course: {
      id: string;
      modules: Array<{
        lessons: Array<{
          id: string;
          videos: { fr?: MobileVideo; en?: MobileVideo };
        }>;
      }>;
    };
  } & Record<string, unknown>;
  exercises: Array<{ id: string } & Record<string, unknown>>;
  cards: Array<{ id: string } & Record<string, unknown>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validate(value: unknown): MobileDefaultData {
  if (!isRecord(value) || !isRecord(value.curriculum) || !isRecord(value.curriculum.course) ||
      typeof value.curriculum.course.id !== 'string' || !Array.isArray(value.curriculum.course.modules) ||
      !Array.isArray(value.exercises) || !Array.isArray(value.cards)) {
    throw new Error('mobile_default_data_invalid');
  }
  return value as MobileDefaultData;
}

const canonicalData = validate(mobileDefaultData);

export async function loadMobileDefaultData(): Promise<MobileDefaultData> {
  return canonicalData;
}
