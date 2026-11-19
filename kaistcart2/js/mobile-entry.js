// Keep the WebGL renderer and course download behind the mobile device gate.
const nav = window.navigator;
const touchMobile = nav.maxTouchPoints > 0 && (
  nav.userAgentData?.mobile === true ||
  /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) ||
  (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
);
const landscape = matchMedia('(orientation: landscape)');
let engineLoading = false;
function updateGate() {
  const canPlay = touchMobile && landscape.matches;
  document.getElementById('desktopGate').classList.toggle('hidden', touchMobile);
  document.getElementById('rotateGate').classList.toggle('hidden', !touchMobile || landscape.matches);
  for (const id of ['title', 'touch', 'hud', 'results', 'pause']) {
    document.getElementById(id).inert = !canPlay;
  }
  if (!canPlay || engineLoading) return;
  engineLoading = true;
  import('./main.js').catch(error => {
    console.error(error);
    document.getElementById('loadMsg').textContent =
      'The game could not load. Check your connection and open this page in a WebGL-capable mobile browser.';
  });
}
if (landscape.addEventListener) landscape.addEventListener('change', updateGate);
else landscape.addListener(updateGate);
updateGate();
