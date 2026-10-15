export type ThemeColor =
  | 'classic'
  | 'pink'
  | 'blue'
  | 'green'
  | 'lavender'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'teal'
  | 'forest'
  | 'midnight'
  | 'petrol'
  | 'coral';

export interface ThemeColors {
  primary: string;
  light: string;
  dark: string;
  accent: string;
  secondary: string;
}
