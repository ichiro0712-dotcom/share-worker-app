export const features = {
  hibarai: process.env.NEXT_PUBLIC_FEATURE_HIBARAI === 'true',
} as const;

export const isHibaraiEnabled = () => features.hibarai;
