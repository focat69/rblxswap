const s = window.launcher;
let c_config = { launcherType: 'default', weblauncherDir: null, theme: null, ignoredUpdate: null };
let cur_ver = '';
let upd_url = '';
let upd_ver = '';

function show_view(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view_' + id).classList.add('active');

    if (id === 'settings') load_settings_ui();
    if (id === 'mac') fetch_hardware();
}
function hide_self() {
    if (s) s.hideWindow();
    show_view('home');
}

const default_theme = { 'bg-base': '#101010', 'bg-accent': '#191919', 'text-main': '#f0f0f0', 'good': '#4ade80', 'bad': '#f87171', 'bg-img': '', 'hide-grid': false };

function apply_theme_var(key, val) {
    if (key === 'bg-img') {
        document.getElementById('bg-img-layer').style.backgroundImage = val ? `url('${val}')` : 'none';
    } else if (key === 'hide-grid') {
        document.documentElement.style.setProperty('--grid-display', val ? 'none' : 'block');
    } else {
        document.documentElement.style.setProperty('--' + key, val);
    }

    // sync checkbox inputs
    const inp = document.querySelector(`input[data-tk="${key}"]`);
    if (inp && inp.type === 'checkbox') {
        inp.checked = (val === true || val === 'true');
    }

    // sync theme-picker swatches (color keys only)
    const picker = document.querySelector(`.theme-picker[data-tk="${key}"]`);
    if (picker) {
        const swatch = picker.querySelector('.color-swatch');
        const hexTxt = picker.querySelector('.hexTxt');
        if (swatch) swatch.style.background = val;
        if (hexTxt) hexTxt.innerText = val;
    }

    if (key === 'bg-img') {
        const nameEl = document.getElementById('bgImgName');
        const clearEl = document.getElementById('bgImgClear');
        if (val) {
            nameEl.innerText = val.split('/').pop().split('\\').pop();
            if (clearEl) clearEl.style.display = 'inline-flex';
        } else {
            nameEl.innerText = 'No file selected';
            if (clearEl) clearEl.style.display = 'none';
        }
    }
}

function apply_theme(input) {
    const key = input.getAttribute('data-tk');
    const val = input.type === 'checkbox' ? input.checked : input.value;
    apply_theme_var(key, val);
    if (!c_config.theme) c_config.theme = { ...default_theme };
    c_config.theme[key] = val;
    if (s) s.setConfig(c_config);
}

function reset_theme() {
    c_config.theme = { ...default_theme };
    Object.keys(c_config.theme).forEach(k => apply_theme_var(k, c_config.theme[k]));
    if (s) s.setConfig(c_config);
}

function handle_bg_file(input) {
    if (input.files && input.files[0]) {
        const path = "file:///" + input.files[0].path.replace(/\\/g, '/');
        document.getElementById('bgImgHidden').value = path;
        const pathParts = input.files[0].path.split(/[\\/]/);
        document.getElementById('bgImgName').innerText = pathParts[pathParts.length - 1];
        document.getElementById('bgImgClear').style.display = 'inline-flex';
        apply_theme(document.getElementById('bgImgHidden'));
    }
}

function clear_bg_file() {
    document.getElementById('bgImgFile').value = '';
    document.getElementById('bgImgHidden').value = '';
    document.getElementById('bgImgName').innerText = 'No file selected';
    document.getElementById('bgImgClear').style.display = 'none';
    apply_theme(document.getElementById('bgImgHidden'));
}

async function init() {

    if (!s) return;

    c_config = await s.getConfig();
    cur_ver = await s.getVersion();
    document.getElementById('vBadge').innerText = cur_ver;

    if (!c_config.theme) c_config.theme = { ...default_theme };

    Object.keys(default_theme).forEach(k => { if (c_config.theme[k] === undefined) c_config.theme[k] = default_theme[k]; });
    Object.keys(c_config.theme).forEach(k => apply_theme_var(k, c_config.theme[k]));

    //-- updates
    const up = await s.checkUpdates();
    if (up.updateAvailable) {
        upd_url = up.url;
        upd_ver = up.version;
        document.getElementById('updStatus').innerHTML = '<span style="color:var(--good); cursor:pointer;" onclick="s.openExternal(\'' + up.url + '\')">Download ' + up.version + '</span>';

        document.getElementById('vBadge').style.cursor = 'pointer';
        document.getElementById('vBadge').style.borderColor = 'var(--good)';
        document.getElementById('vBadge').style.color = 'var(--text-main)';
        document.getElementById('vBadge').style.background = 'rgba(74, 222, 128, 0.2)';

        //-- if not ingored, then we show
        if (c_config.ignoredUpdate !== up.version) {
            document.getElementById('updModalDesc').innerHTML = `Version <b>${up.version}</b> is available!`;
            document.getElementById('updateModal').style.display = 'flex';
        }
    } else {
        document.getElementById('updStatus').innerText = 'Up to date!';
    }
}

async function ignore_update() {
    c_config.ignoredUpdate = upd_ver;
    if (s) await s.setConfig(c_config);
    document.getElementById('updateModal').style.display = 'none';
}

function download_update() {
    if (s && upd_url) s.openExternal(upd_url);
    document.getElementById('updateModal').style.display = 'none';
}

function load_settings_ui() {
    document.querySelector(`input[name="setType"][value="${c_config.launcherType || 'default'}"]`).checked = true;
    document.querySelector(`input[name="spoofMode"][value="${c_config.spoofMode || 'simple'}"]`).checked = true;
    document.getElementById('chkMinimizeClose').checked = c_config.minimizeClose || false;
    document.getElementById('chkPreserveSettings').checked = c_config.preserveSettings || false;
    document.getElementById('chkPreserveFastflags').checked = c_config.preserveFastflags || false;
    toggle_set_weao();
    toggle_spoof_mode();
    if (c_config.weblauncherDir) {
        document.getElementById('txtSetWeao').innerText = c_config.weblauncherDir;
    }
    if (c_config.theme) {
        Object.keys(c_config.theme).forEach(k => apply_theme_var(k, c_config.theme[k]));
    }
}

function toggle_set_weao() {
    const isWeao = document.querySelector('input[name="setType"]:checked').value === 'weao';
    document.getElementById('setWeaoOpt').style.display = isWeao ? 'block' : 'none';
}

function toggle_spoof_mode() {
    const isSimple = document.querySelector('input[name="spoofMode"]:checked')?.value === 'simple';
    document.getElementById('mac_advanced_ui').style.display = isSimple ? 'none' : 'block';
    document.getElementById('mac_simple_ui').style.display = isSimple ? 'block' : 'none';
}

async function scan_set() {
    document.getElementById('txtSetWeao').innerText = 'Scanning...';
    const res = await s.scanWeblauncher();
    if (res) {
        c_config.weblauncherDir = res;
        document.getElementById('txtSetWeao').innerText = res;
    } else {
        document.getElementById('txtSetWeao').innerText = 'Not found. Please Browse.';
    }
}

async function browse_set() {
    const res = await s.selectDir();
    if (res) {
        c_config.weblauncherDir = res;
        document.getElementById('txtSetWeao').innerText = res;
    }
}

async function save_settings() {
    c_config.launcherType = document.querySelector('input[name="setType"]:checked').value;
    c_config.spoofMode = document.querySelector('input[name="spoofMode"]:checked')?.value || 'simple';
    c_config.minimizeClose = document.getElementById('chkMinimizeClose').checked;
    c_config.preserveSettings = document.getElementById('chkPreserveSettings').checked;
    c_config.preserveFastflags = document.getElementById('chkPreserveFastflags').checked;

    if (c_config.launcherType === 'weao' && !c_config.weblauncherDir) {
        alert("Please select your WEAO Web Launcher directory.");
        return;
    }
    if (c_config.launcherType !== 'weao') c_config.weblauncherDir = null;

    await s.setConfig(c_config);
    show_view('home');
}

async function check_upd_manual() {
    const btn = document.getElementById('vBadge');
    const originalText = btn.innerText;
    btn.innerText = 'Checking...';
    document.getElementById('updStatus').innerText = 'Checking...';

    const up = await s.checkUpdates();
    if (up.updateAvailable) {
        document.getElementById('updStatus').innerHTML = `<span style="color:var(--good); cursor:pointer;" onclick="s.openExternal('${up.url}')">Download ${up.version}</span>`;
        btn.innerText = 'Update Available!';
        btn.style.borderColor = 'var(--good)';
        btn.style.color = 'var(--text-main)';
        btn.style.background = 'rgba(74, 222, 128, 0.2)';
    } else {
        document.getElementById('updStatus').innerText = 'Up to date!';
        btn.innerText = 'Up to date!';
        setTimeout(() => {
            if (btn.innerText === 'Up to date!') btn.innerText = originalText;
        }, 2000);
    }
}

let is_sweeping = false;
async function start_clean() {
    if (is_sweeping || !s) return;

    if (c_config.launcherType === 'weao' && !c_config.weblauncherDir) {
        show_view('settings');
        alert("WEAO selected but no path found. Configure it first!");
        return;
    }

    is_sweeping = true;
    show_view('loader');
    document.getElementById('botStatus').innerText = 'Working...';
    document.getElementById('loaderTitle').innerText = 'Initializing...';
    document.getElementById('loaderTitle').style.color = '#fff';
    document.getElementById('loaderRing').setAttribute('stroke', 'var(--text-main)');

    await s.runBypass(c_config.weblauncherDir);
}

if (s) {
    s.onLog(d => {
        document.getElementById('loaderDesc').innerText = d.message;
    });
    s.onStatus(d => {
        if (d.status) document.getElementById('loaderTitle').innerText = d.status.charAt(0).toUpperCase() + d.status.slice(1);
    });
    s.onComplete(d => {
        is_sweeping = false;
        if (d.success !== false) {
            document.getElementById('botStatus').innerText = 'Cleaned';
            setTimeout(() => show_view('post'), 600);
        } else {
            document.getElementById('loaderTitle').style.color = 'var(--bad)';
            document.getElementById('loaderTitle').innerText = 'Failed';
            document.getElementById('loaderRing').setAttribute('stroke', 'var(--bad)');
            document.getElementById('botStatus').innerText = 'Error';
            setTimeout(() => show_view('home'), 3000);
        }
    });
}

const tip = document.getElementById('tooltip');
document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.addEventListener('mousemove', e => {
        tip.innerText = el.getAttribute('data-tooltip');
        tip.style.opacity = '1';

        let x = e.clientX;
        let y = e.clientY + 20;

        const tw = tip.offsetWidth || 150;
        const th = tip.offsetHeight || 30;

        if (x + (tw / 2) > window.innerWidth - 10) x = window.innerWidth - (tw / 2) - 10;
        if (x - (tw / 2) < 10) x = (tw / 2) + 10;
        if (y + th > window.innerHeight - 10) y = e.clientY - th - 5;

        tip.style.left = x + 'px';
        tip.style.top = y + 'px';
    });
    el.addEventListener('mouseleave', () => tip.style.opacity = '0');
    el.addEventListener('mousedown', () => tip.style.opacity = '0');
});

let hw_list = [], hw_target = null;
let is_all_adapters = false;

async function fetch_hardware() {
    if (!s) return;
    hw_list = await s.getAdapters();
    const sb = document.getElementById('selAdapter');
    sb.innerHTML = '';
    hw_list.forEach(a => {
        const o = document.createElement('option');
        o.value = a.Name;
        o.textContent = a.InterfaceDescription;
        sb.appendChild(o);
    });
    if (hw_list.length > 0) {
        hw_target = hw_list[0].Name;
        document.getElementById('inpMac').value = hw_list[0].MacAddress;
    }
}

function toggle_all_adapters() {
    is_all_adapters = document.getElementById('chkAllAdapters').checked;
    document.getElementById('selAdapter').style.opacity = is_all_adapters ? '0.5' : '1';
    document.getElementById('inpMac').style.opacity = is_all_adapters ? '0.5' : '1';
    document.getElementById('selAdapter').disabled = is_all_adapters;
    document.getElementById('inpMac').disabled = is_all_adapters;
}

document.getElementById('selAdapter')?.addEventListener('change', e => {
    hw_target = e.target.value;
    const d = hw_list.find(x => x.Name === hw_target);
    if (d) document.getElementById('inpMac').value = d.MacAddress;
});

function rnd_mac() {
    const trg = hw_list.find(x => x.Name === hw_target);
    const is_mirror = document.getElementById('chkMirror')?.checked;
    const l_bit = ['2', '6', 'A', 'E'];
    let build = "";

    if (is_mirror && trg && trg.MacAddress && trg.MacAddress.length === 17) {
        build = trg.MacAddress[0] + l_bit[Math.floor(Math.random() * 4)] + trg.MacAddress.substring(2, 9);
    } else {
        const hx = () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)];
        build = hx() + l_bit[Math.floor(Math.random() * 4)] + '-' + hx() + hx() + '-' + hx() + hx() + '-';
    }

    const h = () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)];
    const tail = h() + h() + "-" + h() + h() + "-" + h() + h();

    document.getElementById('inpMac').value = build + tail;
}

function mlog(msg, col = '#888') {
    const lb = document.getElementById('macLogs');
    lb.innerHTML += `<div style="color:${col}">> ${msg}</div>`;
    lb.scrollTop = lb.scrollHeight;
}

async function run_spoof() {
    if (!s) return;
    document.getElementById('macLogs').innerHTML = '';

    const isSimple = document.querySelector('input[name="spoofMode"]:checked')?.value === 'simple';
    const targets = (is_all_adapters || isSimple) ? hw_list : hw_list.filter(x => x.Name === hw_target);
    const run_dhcp = isSimple ? false : document.getElementById('chkDhcp').checked;

    if (targets.length === 0) {
        mlog("No valid adapters found to spoof.", 'var(--bad)');
        return;
    }

    let err_count = 0;

    for (const t of targets) {
        let currentNewMac = isSimple ? generate_simple_mac(t) : document.getElementById('inpMac').value;
        mlog(`Spoofing [${t.Name}] to ${currentNewMac}...`, '#aaa');
        try {
            const res = await s.spoofMac(t.InterfaceDescription || '', currentNewMac);
            if (res) {
                mlog('Restarting adapter...', '#aaa');
                await s.restartAdapter(t.Name);
                mlog(`Done [${t.Name}]`, 'var(--good)');
            } else {
                mlog(`Failed [${t.Name}] - Run as admin?`, 'var(--bad)');
                err_count++;
            }
        } catch (e) {
            mlog(`Failed [${t.Name}] - ${e.message}`, 'var(--bad)');
            err_count++;
        }
    }
    if (run_dhcp) {
        mlog('Updating DHCP...', '#aaa');
        await s.dhcpRefresh();
    }
    if (err_count > 0) {
        mlog(`Completed with ${err_count} errors.`, 'var(--bad)');
    } else {
        mlog('MAC Spoofing Complete.', 'var(--good)');
    }
}

function generate_simple_mac(adapter) {
    const l_bit = ['2', '6', 'A', 'E'];
    let build = "";
    if (adapter && adapter.MacAddress && adapter.MacAddress.length === 17) {
        build = adapter.MacAddress[0] + l_bit[Math.floor(Math.random() * 4)] + adapter.MacAddress.substring(2, 9);
    } else {
        const hx = () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)];
        build = hx() + l_bit[Math.floor(Math.random() * 4)] + '-' + hx() + hx() + '-' + hx() + hx() + '-';
    }
    const h = () => "0123456789ABCDEF"[Math.floor(Math.random() * 16)];
    return build + h() + h() + "-" + h() + h() + "-" + h() + h();
}

async function rev_mac() {
    if (!s) return;
    document.getElementById('macLogs').innerHTML = '';

    const isSimple = document.querySelector('input[name="spoofMode"]:checked')?.value === 'simple';
    const run_dhcp = isSimple ? false : document.getElementById('chkDhcp').checked;
    const targets = (is_all_adapters || isSimple) ? hw_list : hw_list.filter(x => x.Name === hw_target);

    if (targets.length === 0) {
        mlog("No valid adapters found to revert.", 'var(--bad)');
        return;
    }

    let err_count = 0;

    for (const t of targets) {
        mlog(`Reverting [${t.Name}]...`, '#aaa');
        try {
            const res = await s.resetMac(t.InterfaceDescription || '');
            if (res) {
                mlog('Restarting adapter...', '#aaa');
                await s.restartAdapter(t.Name);
                mlog(`Done [${t.Name}]`, 'var(--good)');
            } else {
                mlog(`Failed to revert [${t.Name}] - Run as admin?`, 'var(--bad)');
                err_count++;
            }
        } catch (e) {
            mlog(`Failed [${t.Name}] - ${e.message}`, 'var(--bad)');
            err_count++;
        }
    }
    if (run_dhcp) {
        mlog('Updating DHCP...', '#aaa');
        await s.dhcpRefresh();
    }
    if (err_count > 0) {
        mlog(`Completed with ${err_count} errors.`, 'var(--bad)');
    } else {
        mlog('Reversion Complete.', 'var(--good)');
    }
}

function trigger_bao_confetti() {
    for (let i = 0; i < 15; i++) {
        setTimeout(() => {
            const img = document.createElement('img');
            img.src = '../assets/bao.png';
            img.className = 'bao-confetti';
            img.style.left = Math.random() * 100 + 'vw';
            const scale = 0.5 + Math.random() * 1;
            img.style.width = (32 * scale) + 'px';
            img.style.height = (32 * scale) + 'px';
            img.style.animationDuration = (1.5 + Math.random()) + 's';
            img.style.animationDelay = (Math.random() * 0.5) + 's';
            document.body.appendChild(img);
            setTimeout(() => { img.remove(); }, 3000);
        }, i * 50);
    }
}

let pendingConfirmAction = null;

function show_confirm(title, msg, callback) {
    document.getElementById('confirmTitle').innerText = title;
    document.getElementById('confirmMsg').innerText = msg;
    pendingConfirmAction = callback;
    document.getElementById('confirmModal').style.display = 'flex';
}

function close_confirm() {
    document.getElementById('confirmModal').style.display = 'none';
    pendingConfirmAction = null;
}

function execute_confirm() {
    if (pendingConfirmAction) {
        pendingConfirmAction();
    }
    close_confirm();
}

function revert_all_macs_home_confirmed() {
    show_confirm('Revert spoofed MACs?', 'This will reset all network adapters to their original MAC addresses.', async () => {
        if (!s) return;
        const btn = document.getElementById('home_revert_btn');
        const ogText = btn.innerText;
        btn.innerText = "Reverting...";
        btn.style.pointerEvents = "none";

        await fetch_hardware();
        let all_hw = hw_list;
        let err_count = 0;

        for (const t of all_hw) {
            try {
                const res = await s.resetMac(t.InterfaceDescription || '');
                if (res) {
                    await s.restartAdapter(t.Name);
                } else {
                    err_count++;
                }
            } catch (e) { err_count++; }
        }

        btn.innerText = err_count > 0 ? "Reverted (w/ errors)" : "Reverted successfully!";
        setTimeout(() => {
            btn.innerText = ogText;
            btn.style.pointerEvents = "auto";
        }, 3000);
    });
}

function check_mac_tooltip() {
    if (is_all_adapters) return;
    const inp = document.getElementById('inpMac');
    if (hw_target && hw_list.length > 0) {
        const original = hw_list.find(x => x.Name === hw_target)?.MacAddress;
        const current = inp.value;
        if (original !== current) {
            inp.removeAttribute('data-tooltip');
        }
    }
}

function update_mac_tooltip() {
    if (!is_all_adapters) {
        document.getElementById('inpMac').removeAttribute('data-tooltip');
    }
}

init();

// ---- custom color picker ----
(function () {
    const popover = document.getElementById('colorPickr');
    const canvas = document.getElementById('cpCanvas');
    const ctx = canvas.getContext('2d');
    const cursor = document.getElementById('cpCvnCrsr');
    const hueTrack = document.getElementById('cpHueTrack');
    const hueThumb = document.getElementById('cpHueThmb');
    const hexInput = document.getElementById('cpHexInp');
    const preview = document.getElementById('cpPreview');

    let currentHue = 0;
    let currentSx = 1;   // saturation (0-1)
    let currentBx = 0;   // brightness inverse (0=bright, 1=dark)
    let activePicker = null;
    let IsDraggingCvn = false;
    let isDraggingHue = false;

    function hsvToHex(h, s, v) {
        let r, g, b;
        const i = Math.floor(h / 60) % 6;
        const f = h / 60 - Math.floor(h / 60);
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        if (i === 0) { r = v; g = t; b = p; }
        else if (i === 1) { r = q; g = v; b = p; }
        else if (i === 2) { r = p; g = v; b = t; }
        else if (i === 3) { r = p; g = q; b = v; }
        else if (i === 4) { r = t; g = p; b = v; }
        else { r = v; g = p; b = q; }
        const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
        return '#' + toHex(r) + toHex(g) + toHex(b);
    }

    function hexToHsv(hex) {
        hex = hex.replace('#', '');
        if (hex.length !== 6) return null;
        const r = parseInt(hex.slice(0, 2), 16) / 255;
        const g = parseInt(hex.slice(2, 4), 16) / 255;
        const b = parseInt(hex.slice(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const d = max - min;
        let h = 0, s = max === 0 ? 0 : d / max, v = max;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
            else if (max === g) h = ((b - r) / d + 2) * 60;
            else h = ((r - g) / d + 4) * 60;
        }
        return { h, s, v };
    }

    function drawCanvas(hue) {
        const W = canvas.width, H = canvas.height;
        const gradH = ctx.createLinearGradient(0, 0, W, 0);
        gradH.addColorStop(0, '#fff');
        gradH.addColorStop(1, `hsl(${hue},100%,50%)`);
        ctx.fillStyle = gradH;
        ctx.fillRect(0, 0, W, H);
        const gradV = ctx.createLinearGradient(0, 0, 0, H);
        gradV.addColorStop(0, 'rgba(0,0,0,0)');
        gradV.addColorStop(1, 'rgba(0,0,0,1)');
        ctx.fillStyle = gradV;
        ctx.fillRect(0, 0, W, H);
    }

    function posCursor(sx, bx) {
        const W = canvas.offsetWidth, H = canvas.offsetHeight;
        const rect = canvas.getBoundingClientRect();
        cursor.style.left = (rect.left - popover.getBoundingClientRect().left + sx * W) + 'px';
        cursor.style.top = (rect.top - popover.getBoundingClientRect().top + bx * H) + 'px';
    }

    function posHueThmb(hue) {
        hueThumb.style.left = (hue / 360 * 100) + '%';
    }

    function commitColor() {
        if (!activePicker) return;
        const hex = hsvToHex(currentHue, currentSx, 1 - currentBx);
        hexInput.value = hex.replace('#', '').toUpperCase();
        preview.style.background = hex;

        const swatch = activePicker.querySelector('.color-swatch');
        const hexTxt = activePicker.querySelector('.hexTxt');
        if (swatch) swatch.style.background = hex;
        if (hexTxt) hexTxt.innerText = hex;

        const key = activePicker.getAttribute('data-tk');
        if (!c_config.theme) c_config.theme = { ...default_theme };
        c_config.theme[key] = hex;
        document.documentElement.style.setProperty('--' + key, hex);
        if (s) s.setConfig(c_config);
    }

    function pickFrmCvn(e) {
        const rect = canvas.getBoundingClientRect();
        let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        let y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        currentSx = x / rect.width;
        currentBx = y / rect.height;
        posCursor(currentSx, currentBx);
        commitColor();
    }

    function pickFrmHue(e) {
        const rect = hueTrack.getBoundingClientRect();
        let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        currentHue = (x / rect.width) * 360;
        drawCanvas(currentHue);
        posHueThmb(currentHue);
        commitColor();
    }

    canvas.addEventListener('mousedown', e => {
        IsDraggingCvn = true;
        pickFrmCvn(e);
    });
    hueTrack.addEventListener('mousedown', e => {
        isDraggingHue = true;
        pickFrmHue(e);
    });
    document.addEventListener('mousemove', e => {
        if (IsDraggingCvn) pickFrmCvn(e);
        if (isDraggingHue) pickFrmHue(e);
    });
    document.addEventListener('mouseup', () => {
        IsDraggingCvn = false;
        isDraggingHue = false;
    });

    hexInput.addEventListener('input', () => {
        const raw = hexInput.value.replace(/[^0-9a-fA-F]/g, '');
        hexInput.value = raw;
        if (raw.length === 6) {
            const hsv = hexToHsv(raw);
            if (hsv) {
                currentHue = hsv.h;
                currentSx = hsv.s;
                currentBx = 1 - hsv.v;
                drawCanvas(currentHue);
                posCursor(currentSx, currentBx);
                posHueThmb(currentHue);
                preview.style.background = '#' + raw;

                const key = activePicker && activePicker.getAttribute('data-tk');
                if (key) {
                    const hex = '#' + raw;
                    const swatch = activePicker.querySelector('.color-swatch');
                    const hexTxt = activePicker.querySelector('.hexTxt');
                    if (swatch) swatch.style.background = hex;
                    if (hexTxt) hexTxt.innerText = hex;
                    if (!c_config.theme) c_config.theme = { ...default_theme };
                    c_config.theme[key] = hex;
                    document.documentElement.style.setProperty('--' + key, hex);
                    if (s) s.setConfig(c_config);
                }
            }
        }
    });

    document.addEventListener('mousedown', e => {
        if (popover.style.display !== 'none' && !popover.contains(e.target) && !e.target.closest('.theme-picker')) {
            popover.style.display = 'none';
            activePicker = null;
        }
    });

    window.open_color_picker = function (pickerEl) {
        if (activePicker === pickerEl && popover.style.display !== 'none') {
            popover.style.display = 'none';
            activePicker = null;
            return;
        }
        activePicker = pickerEl;

        const hexTxt = pickerEl.querySelector('.hexTxt');
        let startHex = hexTxt ? hexTxt.innerText : '#888888';
        if (!startHex.startsWith('#')) startHex = '#' + startHex;
        const hsv = hexToHsv(startHex.replace('#', '')) || { h: 0, s: 0, v: 1 };
        currentHue = hsv.h;
        currentSx = hsv.s;
        currentBx = 1 - hsv.v;

        drawCanvas(currentHue);
        posHueThmb(currentHue);

        popover.style.display = 'block';
        const pr = pickerEl.getBoundingClientRect();
        let top = pr.bottom + 6;
        let left = pr.left;
        const pw = popover.offsetWidth || 224;
        const ph = popover.offsetHeight || 220;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (top + ph > window.innerHeight - 8) top = pr.top - ph - 6;
        popover.style.top = top + 'px';
        popover.style.left = left + 'px';

        requestAnimationFrame(() => {
            posCursor(currentSx, currentBx);
            hexInput.value = startHex.replace('#', '').toUpperCase();
            preview.style.background = startHex;
        });
    };
})();
