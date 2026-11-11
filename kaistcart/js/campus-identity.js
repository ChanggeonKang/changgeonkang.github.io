// Building names: KAIST campus map, 2026-05. Dimensions below are estimates;
// OSM level/height tags take precedence. Never infer height from array order.
const CURRENT_NAMES = {
  E7: 'Basic Convergence Science Building', E13: 'Chung Mong-Hun Uribyeol Research Building',
  W7: 'Woojung Research Building', N5: 'Convergence Research Building',
  'N7-5': 'Space Mobility Building', 'W5-2': 'Startup Village',
  E2: 'Industrial Engineering & Management Building', 'E2-1': 'Knowledge Service Engineering',
  E3: 'Information & Electronics Building', E16: 'Chung Moon Soul Building',
  N3: 'Ryu Keun Chul Sports Complex', N11: 'Kaimaru',
  'W1-1': 'Department of Materials Science & Engineering', W12: 'West Energy Plant',
};
const WAYPOINT_NAMES = { '북측운동장': 'North Field', '서문': 'West Gate', '우리별연구동 삼거리': 'Uribyeol Research Building Junction' };
export function campusName(b) {
  const ref = b.ref || (b.name || '').match(/\(([NEW]\d+(?:-\d+)?)\)/)?.[1] || '';
  const english = (b.en || '').replace(/\s*\([NEW]\d+(?:-\d+)?\)\s*$/, '').trim();
  const name = CURRENT_NAMES[ref] || WAYPOINT_NAMES[b.name] || english || b.name || ref;
  // Preserve source names in data. Never expose an untranslated source label.
  return /\p{Script=Hangul}/u.test(name) ? ref || 'Campus Building' : name;
}

export function buildingProfile(b) {
  const name = `${b.name || ''} ${b.en || ''}`;
  const residential = /기숙사|아파트|미르관|나래관|소망관|성실관|진리관|사랑관|아름관|희망관|나들관|다솜관|여울관|Housing|Dorm|Apartment|Mir Hall|Narae Hall|Somang|Seongsil|Jilli|Sarang|Areum|Nadl/i.test(name);
  const service = /경비|Guard|창고|Storehouse|기계실|Energy Plant|차고/i.test(name);
  const floorHeight = residential ? 3.05 : service ? 3.8 : 3.6;
  let height, source;
  if (b.hh > 0) { height = b.hh; source = 'OSM height tag'; }
  else if (b.lv > 0) { height = b.lv * floorHeight + .8; source = 'OSM levels × estimated storey height'; }
  else {
    height = /경비|Guard/i.test(name) ? 3.8 : /나래관|Narae Hall/i.test(name) ? 28.25 : /대강당|Auditorium/i.test(name) ? 12 : service ? 6 : residential ? 16 : 11.6;
    source = 'building-use estimate; no measured height';
    if (/나래관|Narae Hall/i.test(name)) source = 'at least 9 floors in official dorm repair notices; 9 × 3.05m + 0.8m conservatively estimated';
  }
  return { height, floorHeight, source, residential, service,
    redRoof: ['N14', 'N16', 'N17', 'N18', 'N19'].includes(b.ref) };
}
