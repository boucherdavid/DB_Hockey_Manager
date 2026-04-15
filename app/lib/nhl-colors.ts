// Couleurs des équipes NHL (primaire + secondaire)
// Source : https://teamcolorcodes.com/nhl-team-color-codes/
export type TeamColors = { primary: string; secondary: string }

export const NHL_TEAM_COLORS: Record<string, TeamColors> = {
  ANA: { primary: '#F47A38', secondary: '#B9975B' },
  BOS: { primary: '#FFB81C', secondary: '#000000' },
  BUF: { primary: '#003087', secondary: '#FCB514' },
  CAR: { primary: '#CC0000', secondary: '#000000' },
  CBJ: { primary: '#002654', secondary: '#CE1126' },
  CGY: { primary: '#C8102E', secondary: '#F1BE48' },
  CHI: { primary: '#CF0A2C', secondary: '#000000' },
  COL: { primary: '#6F263D', secondary: '#236192' },
  DAL: { primary: '#006847', secondary: '#8F8F8C' },
  DET: { primary: '#CE1126', secondary: '#FFFFFF' },
  EDM: { primary: '#041E42', secondary: '#FF4C00' },
  FLA: { primary: '#041E42', secondary: '#C8102E' },
  LAK: { primary: '#111111', secondary: '#A2AAAD' },
  MIN: { primary: '#154734', secondary: '#A6192E' },
  MTL: { primary: '#AF1E2D', secondary: '#003DA5' },
  NJD: { primary: '#CE1126', secondary: '#003DA5' },
  NSH: { primary: '#FFB81C', secondary: '#041E42' },
  NYI: { primary: '#003087', secondary: '#FC4C02' },
  NYR: { primary: '#0038A8', secondary: '#CE1126' },
  OTT: { primary: '#C8102E', secondary: '#000000' },
  PHI: { primary: '#F74902', secondary: '#000000' },
  PIT: { primary: '#000000', secondary: '#FCB514' },
  SEA: { primary: '#001628', secondary: '#99D9D9' },
  SJS: { primary: '#006D75', secondary: '#EA7200' },
  STL: { primary: '#002F87', secondary: '#FCB514' },
  TBL: { primary: '#002868', secondary: '#FFFFFF' },
  TOR: { primary: '#003E7E', secondary: '#FFFFFF' },
  UTA: { primary: '#71AFE5', secondary: '#001628' },
  VAN: { primary: '#00205B', secondary: '#00843D' },
  VGK: { primary: '#333F42', secondary: '#B4975A' },
  WSH: { primary: '#041E42', secondary: '#C8102E' },
  WPG: { primary: '#004C97', secondary: '#AC162C' },
}

export const teamColor = (code: string | null | undefined): TeamColors =>
  NHL_TEAM_COLORS[code ?? ''] ?? { primary: '#94a3b8', secondary: '#cbd5e1' }
