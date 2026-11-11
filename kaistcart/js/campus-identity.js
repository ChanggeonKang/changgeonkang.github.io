// Building names: KAIST campus map, 2026-05. Dimensions below are estimates;
// OSM level/height tags take precedence. Never infer height from array order.
const CURRENT_NAMES = { E7: '기초융합과학동', E13: '정몽헌 우리별 연구동', W7: '우정연구동', N5: '융합연구동', 'N7-5': '우주모빌리티동', 'W5-2': '스타트업빌리지' };
export function campusName(b) { return CURRENT_NAMES[b.ref] || b.name || (b.en || '').replace(/\s*\([NEW]\d+(?:-\d+)?\)\s*$/, ''); }

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
