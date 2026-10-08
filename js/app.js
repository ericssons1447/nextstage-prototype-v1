import { APP_COPY } from "./data.js";
import { loadState, saveState, resetState, exportState } from "./storage.js";
import {
  createLocalAccount,
  signInLocalAccount,
  signOutLocalAccount,
  deleteLocalAccount,
  getLocalAccount,
  isPrototypeSignedIn
} from "./auth.js";

let state = loadState();
let activeRoute = "dashboard";
let installPrompt = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setAuthView(view = "create") {
  const createForm = $("#createAccountForm");
  const signInForm = $("#signInForm");
  const createTab = $("#showCreateAccount");
  const signInTab = $("#showSignIn");

  const showingCreate = view === "create";

  createForm.hidden = !showingCreate;
  signInForm.hidden = showingCreate;

  createTab.classList.toggle("active", showingCreate);
  signInTab.classList.toggle("active", !showingCreate);
}

function applyAuthGate() {
  const authScreen = $("#authScreen");
  const appShell = $(".app-shell");
  const account = getLocalAccount();

  if (isPrototypeSignedIn()) {
    authScreen.hidden = true;
    appShell.hidden = false;
    return;
  }

  authScreen.hidden = false;
  appShell.hidden = true;

  setAuthView(account ? "signin" : "create");
}

async function handleCreateAccount(event) {
  event.preventDefault();

  const form = new FormData(event.target);
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    showToast("Passwords do not match.");
    return;
  }

  try {
    const account = await createLocalAccount({
      firstName: form.get("firstName"),
      lastName: form.get("lastName"),
      displayName: form.get("displayName"),
      username: form.get("username"),
      email: form.get("email"),
      password
    });

    state.profile.firstName = account.firstName;
    state.profile.lastName = account.lastName;
    state.profile.displayName = account.displayName;
    state.profile.username = account.username;

    state.profile.initials =
      `${account.firstName?.[0] || ""}${account.lastName?.[0] || ""}`
        .toUpperCase();

    saveState(state);
    applyAuthGate();
    renderRoute(activeRoute);
    showToast("Prototype account created.");
  } catch (error) {
    showToast(error.message || "Could not create prototype account.");
  }
}

async function handleSignIn(event) {
  event.preventDefault();

  const form = new FormData(event.target);

  try {
    await signInLocalAccount({
      email: form.get("email"),
      password: form.get("password")
    });

    applyAuthGate();
    renderRoute(activeRoute);
    showToast("Signed in.");
  } catch (error) {
    showToast(error.message || "Could not sign in.");
  }
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function totalMinutesToHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}

function getPublicIdentityText(profile) {
  const firstName = String(profile.firstName || "").trim();
  const lastName = String(profile.lastName || "").trim();

  const realName =
    profile.nameFormat === "first"
      ? firstName
      : [firstName, lastName].filter(Boolean).join(" ");

  const displayName =
    String(profile.displayName || "").trim() || realName || "Player";

  const usernameValue = String(profile.username || "")
    .trim()
    .replace(/^@+/, "");

  const username = usernameValue ? `@${usernameValue}` : "";

  const modes = {
    display: [displayName],
    username: [username],
    name: [realName],
    "display-username": [displayName, username],
    "name-username": [realName, username],
    "display-name": [displayName, realName],
    all: [displayName, username, realName]
  };

  const selected = modes[profile.publicIdentityMode] || modes.display;

  return selected.filter(Boolean).join(" · ");
}

function initializeCharacterCounters(root = document) {
  const fields = root.querySelectorAll(
    'input[maxlength]:not([type="password"]):not([type="email"]):not([type="search"]), textarea[maxlength]'
  );

  fields.forEach((field, index) => {
    if (field.dataset.counterReady === "true") return;

    const maxLength = Number(field.maxLength);
    if (!maxLength || maxLength < 100) return;

    field.dataset.counterReady = "true";

    const counter = document.createElement("div");
    counter.className = "char-counter";
    counter.textContent = `${field.value.length} / ${maxLength}`;

    field.insertAdjacentElement("afterend", counter);
  });
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2500);
}

function syncWeeklyGoal() {
  const goal = state.goals.find(goal => goal.id === "g1");
  if (!goal) return;

  const current = state.development.currentWeekHours;
  const target = state.development.weeklyGoal;

  goal.progress = Math.min(
    100,
    Math.round((current / target) * 100)
  );

  goal.detail = `Current: ${current.toFixed(1)} of ${target} hours`;
}

function syncTrueTouchGoal() {
  const goal = state.goals.find(goal => goal.id === "g2");
  if (!goal) return;

  const current = state.development.trueTouchHours;
  const target = 25;

  const formattedCurrent = current
    .toFixed(2)
    .replace(/\.?0+$/, "");

  goal.progress = Math.min(
    100,
    Math.round((current / target) * 100)
  );

  goal.detail = `Current: ${formattedCurrent} of ${target} hours`;
}

function setRoute(route) {
  activeRoute = route;
  $$(".view").forEach(view => view.classList.toggle("active", view.dataset.view === route));
  $$('[data-route]').forEach(button => button.classList.toggle("active", button.dataset.route === route));
  renderRoute(route);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function pageHead(eyebrow, title, description, actions = "") {
  return `
    <div class="page-head">
      <div>
        <p class="eyebrow">${escapeHtml(eyebrow)}</p>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(description)}</p>
      </div>
      ${actions}
    </div>`;
}

function progressBar(label, score) {
  return `
    <div class="progress-row">
      <div class="progress-meta"><strong>${escapeHtml(label)}</strong><span>${score}%</span></div>
      <div class="progress-track"><div class="progress-fill" style="width:${Math.max(0, Math.min(100, score))}%"></div></div>
    </div>`;
}

function renderDashboard() {
  const view = $("#view-dashboard");
  const p = state.profile;
  const d = state.development;
  const weeklyPct = Math.min(100, Math.round((d.currentWeekHours / d.weeklyGoal) * 100));
  const recent = state.sessions.slice(0, 4);

  view.innerHTML = `
    ${pageHead("Athlete Dashboard", `Good ${getDaypart()}, ${p.firstName}`, "Track development, discover opportunities, and build a soccer story that reflects your actual path.")}

    <div class="hero-card">
      <div class="hero-grid">
        <div>
          <p class="eyebrow" style="color:#74e7a5">Current development stage</p>
          <h2>${escapeHtml(d.level)}</h2>
          <p>${escapeHtml(p.headline)}. Prototype V1 is designed to demonstrate how development, exposure, and opportunity discovery could live in one place.</p>
          <div class="hero-actions">
            <button class="button primary" data-action="log-training">＋ Log training</button>
            <button class="button blue" data-route="discover">Discover opportunities</button>
          </div>
        </div>
        <div class="hero-score">
          <div class="score-ring" style="--progress:${p.profileCompletion}">
            <div class="score-ring-inner"><strong>${p.profileCompletion}%</strong><span>Profile complete</span></div>
          </div>
        </div>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><span class="label">TOTAL DEVELOPMENT</span><strong>${d.totalHours.toFixed(1)}h</strong><small>All logged activity</small></div>
      <div class="stat-card"><span class="label">TRUE-TOUCH HOURS</span><strong>${d.trueTouchHours.toFixed(1)}h</strong><small>Ball-contact focused</small></div>
      <div class="stat-card"><span class="label">THIS WEEK</span><strong>${d.currentWeekHours.toFixed(1)}h</strong><small>${weeklyPct}% of ${d.weeklyGoal}h goal</small></div>
      <div class="stat-card"><span class="label">SAVED OPPORTUNITIES</span><strong>${state.savedOpportunityIds.length}</strong><small>Ready to compare</small></div>
    </div>

    <div class="content-grid profile-tab-panel" data-profile-panel="overview">
      <div class="card">
        <div class="card-header">
          <div><h3>Development snapshot</h3><p class="card-subtitle">Prototype skill categories - self-reported/demo values</p></div>
          <button class="button blue small" data-route="development">Open tracker</button>
        </div>
        ${d.categories.map(x => progressBar(x.name, x.score)).join("")}
      </div>

      <div class="stack">
        <div class="card">
          <div class="card-header"><div><h3>Current goals</h3><p class="card-subtitle">Keep the next steps visible</p></div><button class="button amber small" data-action="add-goal">＋ Goal</button></div>
          <div class="goal-list">
            ${state.goals.slice(0, 2).map(goal => `
              <div class="goal-card">
                <h4>${escapeHtml(goal.title)}</h4>
                <p>${escapeHtml(goal.detail)}</p>
                <div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:${goal.progress}%"></div></div>
              </div>`).join("")}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div><h3>Recent activity</h3><p class="card-subtitle">Your latest logged development</p></div></div>
          <div class="activity-list">
            ${recent.map(session => `
              <div class="activity-item">
                <div class="activity-icon">⚽</div>
                <div class="activity-copy"><strong>${escapeHtml(session.type)}</strong><span>${formatDate(session.date)} · ${escapeHtml(session.focus)}</span></div>
                <div class="activity-value">${session.minutes}m</div>
              </div>`).join("")}
          </div>
        </div>
      </div>
    </div>

    <div class="notice info section-space">${escapeHtml(APP_COPY.prototypeDisclaimer)}</div>`;
}

function renderProfile() {
  const view = $("#view-profile");
  const p = state.profile;
 const publicIdentity = getPublicIdentityText(p);
  view.innerHTML = `
    ${pageHead("Athlete Passport", "Your soccer identity, in one profile", "Prototype of an athlete-controlled profile designed to show development, experience, goals, and verified accomplishments over time.", `<button class="button navy" data-action="edit-profile">Edit profile</button>`)}

    <div class="card profile-hero">
      <div class="profile-avatar">${escapeHtml(p.initials)}</div>
      <div class="profile-name">
       <h2>${escapeHtml(publicIdentity)}</h2>
        <p>${escapeHtml(p.headline)}</p>
        <div class="tag-row"><span class="tag green">${escapeHtml(p.primaryPosition)}</span><span class="tag">${escapeHtml(p.experienceLevel)}</span><span class="tag blue">${escapeHtml(p.city)}, ${escapeHtml(p.region)}</span></div>
      </div>
      <button class="button purple" data-action="share-demo">Share demo profile</button>
    </div>

      <div class="tabs" role="tablist" aria-label="Athlete Passport sections">
       <button class="tab active" type="button" data-action="profile-tab" data-profile-tab="overview">Overview</button>
      <button class="tab" type="button" data-action="profile-tab" data-profile-tab="development">Development</button>
      <button class="tab" type="button" data-action="profile-tab" data-profile-tab="experience">Experience</button>
      <button class="tab" type="button" data-action="profile-tab" data-profile-tab="achievements">Achievements</button>
      <button class="tab" type="button" data-action="profile-tab" data-profile-tab="highlights">Highlights</button>
   </div>

  <div class="content-grid profile-tab-panel" data-profile-panel="overview">
      <div class="stack">
        <div class="card"><h3>About</h3><p class="bio">${escapeHtml(p.bio)}</p></div>
        <div class="card">
          <div class="card-header"><div><h3>Achievements</h3><p class="card-subtitle">Prototype milestones and future verification area</p></div></div>
          <div class="simple-list">
            ${state.achievements.map(a => `<div class="simple-item"><div class="activity-icon">★</div><div class="activity-copy"><strong>${escapeHtml(a.title)}</strong><span>${escapeHtml(a.type)} · ${formatDate(a.date)}</span></div></div>`).join("")}
          </div>
        </div>
      </div>
      <div class="stack">
        <div class="card">
          <h3>Player details</h3>
          <div class="profile-info-grid section-space">
            <div class="info-cell"><span>Primary position</span><strong>${escapeHtml(p.primaryPosition)}</strong></div>
            <div class="info-cell"><span>Secondary</span><strong>${escapeHtml(p.secondaryPosition)}</strong></div>
            <div class="info-cell"><span>Dominant foot</span><strong>${escapeHtml(p.dominantFoot)}</strong></div>
            <div class="info-cell"><span>Experience</span><strong>${escapeHtml(p.experienceLevel)}</strong></div>
            <div class="info-cell"><span>Location</span><strong>${escapeHtml(`${p.city}, ${p.region}`)}</strong></div>
            <div class="info-cell"><span>Availability</span><strong>${escapeHtml(p.availability)}</strong></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><div><h3>Profile completion</h3><p class="card-subtitle">A future production version could guide athletes through missing fields.</p></div></div>
          ${progressBar("Athlete Passport", p.profileCompletion)}
        </div>
      </div>
          </div>

     <div class="profile-tab-panel" data-profile-panel="development" hidden>

  <div class="stat-grid">
    <div class="stat-card">
      <span class="label">TOTAL DEVELOPMENT</span>
      <strong>${state.development.totalHours.toFixed(1)}h</strong>
      <small>All logged activity</small>
    </div>

    <div class="stat-card">
      <span class="label">TRUE-TOUCH HOURS</span>
      <strong>${state.development.trueTouchHours.toFixed(1)}h</strong>
      <small>Ball-contact focused</small>
    </div>

    <div class="stat-card">
      <span class="label">TRAINING SESSIONS</span>
      <strong>${state.sessions.length}</strong>
      <small>Logged sessions</small>
    </div>

    <div class="stat-card">
      <span class="label">ACTIVE GOALS</span>
      <strong>${state.goals.length}</strong>
      <small>Current priorities</small>
    </div>
  </div>

  <div class="content-grid equal section-space">

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Skill progress</h3>
          <p class="card-subtitle">
            Current prototype development categories
          </p>
        </div>
      </div>

      ${state.development.categories
        .map(x => progressBar(x.name, x.score))
        .join("")}
    </div>

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Current goals</h3>
          <p class="card-subtitle">
            The next development priorities
          </p>
        </div>

        <button
          class="button amber small"
          data-action="add-goal"
        >
          ＋ Goal
        </button>
      </div>

      <div class="goal-list">
        ${state.goals.slice(0, 3).map(goal => `
          <div class="goal-card">
            <h4>${escapeHtml(goal.title)}</h4>
            <p>${escapeHtml(goal.detail)}</p>

            <div class="progress-track" style="margin-top:10px">
              <div
                class="progress-fill"
                style="width:${goal.progress}%"
              ></div>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

  </div>

  <div class="content-grid section-space">

    <div class="card">
      <div class="card-header">
        <div>
          <h3>Recent training</h3>
          <p class="card-subtitle">
            Your latest development activity
          </p>
        </div>
      </div>

      <div class="activity-list">
        ${state.sessions.slice(0, 3).map(session => `
          <div class="activity-item">
            <div class="activity-icon">⚽</div>

            <div class="activity-copy">
              <strong>${escapeHtml(session.type)}</strong>
              <span>
                ${formatDate(session.date)} ·
                ${escapeHtml(session.focus)}
              </span>
            </div>

            <button
              class="button blue small"
              data-session-id="${session.id}"
              data-action="session-detail"
            >
              View
            </button>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card">
      <h3>Development actions</h3>

      <p class="bio">
        Continue tracking development or open the complete
        Development workspace for the full training log,
        goals, skill categories, and activity history.
      </p>

      <div class="card-actions section-space">
        <button
          class="button primary"
          data-action="log-training"
        >
          ＋ Log training
        </button>

        <button
          class="button blue"
          data-route="development"
        >
          Open full tracker
        </button>
      </div>
    </div>

  </div>

</div>

      <div class="card profile-tab-panel" data-profile-panel="experience" hidden>
        <div class="card-header">
          <div>
            <h3>Experience</h3>
            <p class="card-subtitle">Your playing background and current soccer experience.</p>
          </div>
        </div>

        <div class="profile-info-grid section-space">
          <div class="info-cell">
            <span>Experience level</span>
            <strong>${escapeHtml(p.experienceLevel)}</strong>
          </div>

          <div class="info-cell">
            <span>Primary position</span>
            <strong>${escapeHtml(p.primaryPosition)}</strong>
          </div>

          <div class="info-cell">
            <span>Secondary position</span>
            <strong>${escapeHtml(p.secondaryPosition)}</strong>
          </div>

          <div class="info-cell">
            <span>Availability</span>
            <strong>${escapeHtml(p.availability)}</strong>
          </div>
        </div>

        <p class="bio section-space">
          A full experience timeline for clubs, leagues, camps, training programs, and other playing history can be built into this section next.
        </p>
      </div>

      <div class="card profile-tab-panel" data-profile-panel="achievements" hidden>
        <div class="card-header">
          <div>
            <h3>Achievements</h3>
            <p class="card-subtitle">Milestones and accomplishments connected to your soccer journey.</p>
          </div>
        </div>

        <div class="profile-info-grid section-space">
          <div class="info-cell">
            <span>Achievements recorded</span>
            <strong>${state.achievements.length}</strong>
          </div>

          <div class="info-cell">
            <span>Goals tracked</span>
            <strong>${state.goals.length}</strong>
          </div>
        </div>

        <p class="bio section-space">
          This section will become the dedicated home for awards, milestones, certifications, selections, completed goals, and other accomplishments.
        </p>
      </div>

      <div class="card profile-tab-panel" data-profile-panel="highlights" hidden>
        <div class="card-header">
          <div>
            <h3>Highlights</h3>
            <p class="card-subtitle">Featured moments from your development journey.</p>
          </div>
        </div>

        <div class="profile-info-grid section-space">
          <div class="info-cell">
            <span>Logged sessions</span>
            <strong>${state.sessions.length}</strong>
          </div>

          <div class="info-cell">
            <span>Profile completion</span>
            <strong>${p.profileCompletion}%</strong>
          </div>
        </div>

        <p class="bio section-space">
          Video clips, photos, match highlights, training highlights, and featured moments will live here as the media system is added.
        </p>
      </div>`;
}

function setProfileTab(tabName) {
  const profileView = $("#view-profile");
  if (!profileView) return;

  $$("[data-profile-tab]", profileView).forEach(button => {
    const isActive = button.dataset.profileTab === tabName;

    button.classList.toggle("active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  $$("[data-profile-panel]", profileView).forEach(panel => {
    panel.hidden = panel.dataset.profilePanel !== tabName;
  });
}

function renderDevelopment() {
  const view = $("#view-development");
  const max = Math.max(...state.weeklyHours.map(x => x.hours), 1);
  view.innerHTML = `
    ${pageHead("Development", "Build proof of progress", "Log training, organize goals, and visualize growth without pretending every athlete follows the same path.", `<button class="button primary" data-action="log-training">＋ Log training</button>`)}

    <div class="stat-grid">
      <div class="stat-card"><span class="label">TOTAL HOURS</span><strong>${state.development.totalHours.toFixed(1)}</strong><small>Development history</small></div>
      <div class="stat-card"><span class="label">TRUE TOUCH</span><strong>${state.development.trueTouchHours.toFixed(1)}</strong><small>Technical contact time</small></div>
      <div class="stat-card"><span class="label">SESSIONS</span><strong>${state.sessions.length}</strong><small>Logged in this demo</small></div>
      <div class="stat-card"><span class="label">ACTIVE GOALS</span><strong>${state.goals.length}</strong><small>Current priorities</small></div>
    </div>

    <div class="content-grid equal">
      <div class="card">
        <div class="card-header"><div><h3>Six-week activity</h3><p class="card-subtitle">Hours logged by week</p></div></div>
        <div class="chart-bars">
          ${state.weeklyHours.map(w => `<div class="bar-wrap"><div class="bar" title="${w.hours} hours" style="height:${Math.max(4, (w.hours/max)*155)}px"></div><small>${escapeHtml(w.label)}</small></div>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div><h3>Skill categories</h3><p class="card-subtitle">Prototype structure, not an official rating</p></div></div>
        ${state.development.categories.map(x => progressBar(x.name, x.score)).join("")}
      </div>
    </div>

    <div class="content-grid section-space">
      <div class="card">
        <div class="card-header"><div><h3>Training log</h3><p class="card-subtitle">Most recent sessions first</p></div></div>
        <div class="activity-list">
          ${state.sessions.map(s => `
            <div class="activity-item">
              <div class="activity-icon">↗</div>
              <div class="activity-copy"><strong>${escapeHtml(s.type)} · ${s.minutes} min</strong><span>${formatDate(s.date)} · ${escapeHtml(s.focus)} · ${s.trueTouchMinutes} true-touch min</span></div>
              <button class="button blue small" data-session-id="${s.id}" data-action="session-detail">View</button>
            </div>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><div><h3>Goals</h3><p class="card-subtitle">Turn broad ambitions into visible next steps</p></div><button class="button amber small" data-action="add-goal">＋ Add</button></div>
        <div class="goal-list">
          ${state.goals.map(g => `
            <div class="goal-card">
              <div class="goal-top"><div><h4>${escapeHtml(g.title)}</h4><p>${escapeHtml(g.target)} · ${escapeHtml(g.detail)}</p></div><div class="goal-actions"><button class="button primary small" data-action="advance-goal" data-goal-id="${g.id}">+10%</button></div></div>
              <div class="progress-track" style="margin-top:10px"><div class="progress-fill" style="width:${g.progress}%"></div></div>
            </div>`).join("")}
        </div>
      </div>
    </div>`;
}

function renderDiscover() {
  const view = $("#view-discover");
  view.innerHTML = `
    ${pageHead("Discover", "Find a next step that actually fits", "Prototype search across teams, training, pickup, leagues, trainers, facilities, and other soccer opportunities.")}
    <div class="filter-row">
      <div class="search-box"><input id="opportunitySearch" type="search" placeholder="Search team, training, pickup, location..." /></div>
      <select class="select-box" id="opportunityTypeFilter"><option value="all">All types</option>${[...new Set(state.opportunities.map(o => o.type))].map(t => `<option>${escapeHtml(t)}</option>`).join("")}</select>
    </div>
    <div class="notice" style="margin-bottom:16px">All listings below are fictional/demo content. Prototype V1 does not verify availability, organizations, pricing, or schedules.</div>
    <div class="opportunity-grid" id="opportunityGrid"></div>`;
  renderOpportunityGrid();
}

function renderOpportunityGrid() {
  const grid = $("#opportunityGrid");
  if (!grid) return;
  const q = ($("#opportunitySearch")?.value || "").trim().toLowerCase();
  const type = $("#opportunityTypeFilter")?.value || "all";
  const matches = state.opportunities.filter(o => {
    const haystack = `${o.title} ${o.organization} ${o.city} ${o.type} ${o.level} ${o.tags.join(" ")}`.toLowerCase();
    return (!q || haystack.includes(q)) && (type === "all" || o.type === type);
  });
  grid.innerHTML = matches.length ? matches.map(opportunityCard).join("") : `<div class="empty-state"><div class="empty-icon">⌕</div><strong>No demo opportunities match.</strong><p>Try another search or filter.</p></div>`;
}

function opportunityCard(o) {
  const saved = state.savedOpportunityIds.includes(o.id);
  return `
    <article class="opportunity-card">
      <div class="opportunity-top">
        <div><span class="opportunity-type">${escapeHtml(o.type)}</span><h3>${escapeHtml(o.title)}</h3><p>${escapeHtml(o.organization)}</p></div>
        <button class="save-button ${saved ? "saved" : ""}" data-action="toggle-save" data-opportunity-id="${o.id}" aria-label="${saved ? "Unsave" : "Save"} opportunity">${saved ? "♥" : "♡"}</button>
      </div>
      <div class="meta-line"><span>⌖ ${escapeHtml(o.city)}</span><span>◫ ${escapeHtml(o.level)}</span><span>◷ ${escapeHtml(o.schedule)}</span><span>${escapeHtml(o.cost)}</span></div>
      <p>${escapeHtml(o.description)}</p>
      <div class="tag-row">${o.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
      <button class="button blue small" data-action="opportunity-detail" data-opportunity-id="${o.id}">View details</button><button class="button purple small" data-action="prototype-contact">Contact / Join</button>></div>
    </article>`;
}

function renderCoach() {
  const p = state.profile;
  const d = state.development;
  const view = $("#view-coach");
  const publicIdentity = getPublicIdentityText(p);
  view.innerHTML = `
    ${pageHead("Coach / Scout View", "See the athlete from the other side", "A prototype of what a coach, trainer, club, or scout could see when an athlete intentionally shares a NextStage profile.")}
    <div class="card scout-card">
      <div class="profile-hero">
        <div class="profile-avatar" style="background:#153957">${escapeHtml(p.initials)}</div>
        <div class="profile-name"><h2>${escapeHtml(publicIdentity)}</h2><p>${escapeHtml(p.headline)}</p><div class="tag-row"><span class="tag green">${escapeHtml(p.primaryPosition)}</span><span class="tag blue">${escapeHtml(p.city)}, ${escapeHtml(p.region)}</span></div></div>
        <button class="button purple" data-action="prototype-contact">Request contact</button>
      </div>
      <div class="scout-metrics">
        <div class="scout-metric"><strong>${d.totalHours.toFixed(1)}h</strong><span>Tracked development</span></div>
        <div class="scout-metric"><strong>${d.trueTouchHours.toFixed(1)}h</strong><span>True-touch activity</span></div>
        <div class="scout-metric"><strong>${state.sessions.length}</strong><span>Visible recent sessions</span></div>
      </div>
    </div>
    <div class="content-grid section-space">
      <div class="card"><div class="card-header"><div><h3>Development evidence</h3><p class="card-subtitle">Athlete-controlled prototype information</p></div></div>${d.categories.map(x => progressBar(x.name, x.score)).join("")}</div>
      <div class="stack">
        <div class="card"><h3>What the athlete says</h3><p class="bio">${escapeHtml(p.bio)}</p></div>
        <div class="card"><h3>Coach / scout notes</h3><p class="bio">${escapeHtml(state.notes.coach)}</p><button class="button navy small" data-action="prototype-note">Add private note</button></div>
      </div>
    </div>
    <div class="notice info section-space">Production design should include athlete consent, visibility controls, verification indicators, safeguarding, reporting, and careful rules for minors before real recruiting or messaging features are enabled.</div>`;
}

function renderSaved() {
  const view = $("#view-saved");
  const saved = state.opportunities.filter(o => state.savedOpportunityIds.includes(o.id));
  view.innerHTML = `
    ${pageHead("Saved", "Keep promising opportunities together", "Compare options without losing them in screenshots, bookmarks, or messages.")}
    <div class="opportunity-grid">${saved.length ? saved.map(opportunityCard).join("") : `<div class="empty-state"><div class="empty-icon">♡</div><strong>No saved opportunities yet.</strong><p>Open Discover and tap the heart on a demo listing.</p><button class="button blue" data-route="discover">Open Discover</button></div>`}</div>`;
}

function renderSettings() {
  const view = $("#view-settings");
  view.innerHTML = `
    ${pageHead("Settings", "Prototype controls", "Manage local demo data, install the PWA, or reset the prototype.")}
    <div class="content-grid equal">
      <div class="card">
        <h3>Prototype data</h3>
        <div class="settings-list section-space">
          <div class="setting-row"><div><strong>Export demo data</strong><span>Downloads your current local prototype state as JSON.</span></div><button class="button secondary small" data-action="export-data">Export</button></div>
          <div class="setting-row"><div><strong>Reset prototype</strong><span>Restores the original demo profile, sessions, goals, and saves.</span></div><button class="button danger small" data-action="reset-data">Reset</button></div>
        </div>
      </div>
      <div class="card">
      <h3>Prototype account</h3>
      <div class="settings-list section-space">
      <div class="setting-row">
      <div>
        <strong>Sign out</strong>
        <span>Sign out of this prototype account on this browser.</span>
      </div>
      <button class="button secondary" data-action="account-signout">Sign out</button>
    </div>

    <div class="setting-row">
      <div>
        <strong>Delete prototype account</strong>
        <span>Permanently removes this local prototype account from this browser/device.</span>
      </div>
      <button class="button secondary" data-action="account-delete">Delete account</button>
    </div>
  </div>
</div>
      <div class="card">
        <h3>Install NextStage</h3>
        <p class="bio">On a supported device, install this website as a web app. On iPhone/iPad, use Safari's Share menu and Add to Home Screen / Open as Web App. On Android Chrome, use Install app when available.</p>
        <button class="button primary" data-action="install-app">Install if available</button>
      </div>
    </div>
    <div class="card section-space"><h3>Safety & privacy reminder</h3><p class="bio">${escapeHtml(APP_COPY.privacyReminder)}</p><p class="bio">This V1 stores changes only in this browser's localStorage. Clearing site data, using another device, or opening a private browsing session can remove or isolate those changes.</p></div>`;
}

function renderRoute(route) {
  syncWeeklyGoal();
  syncTrueTouchGoal();
  const avatarInitials = $("#avatarInitials");
  if (avatarInitials) avatarInitials.textContent = state.profile.initials || "DP";
  
  const renderers = {
    dashboard: renderDashboard,
    profile: renderProfile,
    development: renderDevelopment,
    discover: renderDiscover,
    coach: renderCoach,
    saved: renderSaved,
    settings: renderSettings
  };
  renderers[route]?.();
}

function openModal({ eyebrow = "NextStage", title, body }) {
  $("#modalEyebrow").textContent = eyebrow;
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = body;
  $("#modalBackdrop").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  $("#modalBackdrop").hidden = true;
  document.body.style.overflow = "";
}

function mobileMoreModal() {
  openModal({
    eyebrow: "Navigation",
    title: "More",
    body: `
      <div class="settings-list">
        <button class="button secondary" data-route="profile">Athlete Passport</button>
        <button class="button secondary" data-route="coach">Coach / Scout View</button>
        <button class="button secondary" data-route="saved">Saved</button>
        <button class="button secondary" data-route="settings">Settings</button>
      </div>`
  });
}

function trainingModal() {
  const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  openModal({
    eyebrow: "Development tracker",
    title: "Log a training session",
    body: `
      <form id="trainingForm">
        <div class="form-grid">
          <div class="field"><label>Date</label><input name="date" type="date" value="${today}" required></div>
          <div class="field"><label>Session type</label><select name="type"><option>Individual technical</option><option>Small-group training</option><option>Team training</option><option>Open play</option><option>Match</option><option>Fitness</option><option>Tactical study</option></select></div>
          <div class="field"><label>Total minutes</label><input name="minutes" type="number" min="1" max="600" value="60" required></div>
          <div class="field"><label>True-touch minutes</label><input name="trueTouchMinutes" type="number" min="0" max="600" value="30" required></div>
          <div class="field full"><label>Main focus</label><input name="focus" maxlength="120" placeholder="Example: first touch and passing" required></div>
          <div class="field full"><label>Notes</label><textarea name="notes" maxlength="500" placeholder="What went well? What needs work?"></textarea></div>
        </div>
        <div class="form-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Save session</button></div>
      </form>`
  });
}

function goalModal() {
  openModal({
    eyebrow: "Development goals",
    title: "Add a goal",
    body: `
      <form id="goalForm">
        <div class="form-grid">
          <div class="field full"><label>Goal</label><input name="title" maxlength="120" placeholder="Example: Attend four adult open-play sessions" required></div>
          <div class="field"><label>Target period</label><input name="target" maxlength="50" placeholder="Example: Next 6 weeks" required></div>
          <div class="field"><label>Starting progress (%)</label><input name="progress" type="number" min="0" max="100" value="0" required></div>
          <div class="field full"><label>Progress note</label><input name="detail" maxlength="140" placeholder="Example: 0 of 4 sessions complete"></div>
        </div>
        <div class="form-actions"><button type="button" class="button secondary" data-action="close-modal">Cancel</button><button class="button primary" type="submit">Add goal</button></div>
      </form>`
  });
}

function profileModal() {
  const p = state.profile;
  openModal({
    eyebrow: "Athlete Passport",
    title: "Edit demo profile",
    body: `
      <form id="profileForm">
        <div class="form-grid">
        <div class="field"><label>First name *</label><input name="firstName" maxlength="50" value="${escapeHtml(p.firstName)}" required></div>
        <div class="field"><label>Last name *</label><input name="lastName" maxlength="50" value="${escapeHtml(p.lastName)}" required></div>
        <div class="field"><label>Display name *</label><input name="displayName" maxlength="60" value="${escapeHtml(p.displayName || "")}" required></div>
        <div class="field"><label>Username *</label><input name="username" maxlength="30" value="${escapeHtml(p.username || "")}" required></div>

<div class="field full">
  <label>Public identity</label>
  <select name="publicIdentityMode">
    <option value="display" ${p.publicIdentityMode === "display" ? "selected" : ""}>Display name only</option>
    <option value="username" ${p.publicIdentityMode === "username" ? "selected" : ""}>Username only</option>
    <option value="name" ${p.publicIdentityMode === "name" ? "selected" : ""}>Name only</option>
    <option value="display-username" ${p.publicIdentityMode === "display-username" ? "selected" : ""}>Display name + username</option>
    <option value="name-username" ${p.publicIdentityMode === "name-username" ? "selected" : ""}>Name + username</option>
    <option value="display-name" ${p.publicIdentityMode === "display-name" ? "selected" : ""}>Display name + name</option>
    <option value="all" ${p.publicIdentityMode === "all" ? "selected" : ""}>All</option>
  </select>
</div>

<div class="field full">
  <label>Name format</label>
  <select name="nameFormat">
    <option value="first" ${p.nameFormat === "first" ? "selected" : ""}>First name only</option>
    <option value="first-last" ${(p.nameFormat || "first-last") === "first-last" ? "selected" : ""}>First + last name</option>
  </select>
</div>

<div class="field full"><label>Headline *</label><input name="headline" maxlength="100" value="${escapeHtml(p.headline)}" required></div>
<div class="field"><label>City</label><input name="city" maxlength="60" value="${escapeHtml(p.city)}"></div>
<div class="field"><label>State / province / region</label><input name="region" maxlength="60" value="${escapeHtml(p.region)}"></div>
<div class="field full"><label>Country</label><input name="country" maxlength="60" value="${escapeHtml(p.country || "")}"></div>
<div class="field"><label>Primary position</label><input name="primaryPosition" maxlength="50" value="${escapeHtml(p.primaryPosition)}"></div>
<div class="field"><label>Secondary position</label><input name="secondaryPosition" maxlength="50" value="${escapeHtml(p.secondaryPosition)}"></div>
<div class="field full"><label>Bio</label><textarea name="bio" maxlength="500" data-char-counter="bio">${escapeHtml(p.bio)}</textarea><div class="char-counter" data-char-counter-output="bio">${String(p.bio || "").length} / 500</div></div>
</div>

<div class="form-actions">
  <button type="button" class="button secondary" data-action="close-modal">Cancel</button>
  <button class="button primary" type="submit">Save changes</button>
</div>
</form>`
});
}

function opportunityDetail(id) {
  const o = state.opportunities.find(x => x.id === id);
  if (!o) return;
  openModal({
    eyebrow: o.type,
    title: o.title,
    body: `<div class="stack"><div class="notice">Fictional/demo listing - do not treat this as a real opportunity.</div><p class="bio">${escapeHtml(o.description)}</p><div class="profile-info-grid"><div class="info-cell"><span>Organization</span><strong>${escapeHtml(o.organization)}</strong></div><div class="info-cell"><span>Location</span><strong>${escapeHtml(o.city)}</strong></div><div class="info-cell"><span>Level</span><strong>${escapeHtml(o.level)}</strong></div><div class="info-cell"><span>Schedule</span><strong>${escapeHtml(o.schedule)}</strong></div></div><div class="tag-row">${o.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div><div class="form-actions"><button class="button secondary" data-action="close-modal">Close</button><button class="button primary" data-action="prototype-contact">Contact / Join</button></div></div>`
  });
}

function sessionDetail(id) {
  const s = state.sessions.find(x => x.id === id);
  if (!s) return;
  openModal({
    eyebrow: "Training log",
    title: `${s.type} · ${formatDate(s.date)}`,
    body: `<div class="profile-info-grid"><div class="info-cell"><span>Total duration</span><strong>${s.minutes} minutes</strong></div><div class="info-cell"><span>True touch</span><strong>${s.trueTouchMinutes} minutes</strong></div><div class="info-cell"><span>Focus</span><strong>${escapeHtml(s.focus)}</strong></div><div class="info-cell"><span>Logged hours</span><strong>${totalMinutesToHours(s.minutes)} hours</strong></div></div><p class="bio">${escapeHtml(s.notes || "No notes saved.")}</p>`
  });
}

function getDaypart() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function saveAndRefresh(message) {
  saveState(state);
  renderRoute(activeRoute);
  if (message) showToast(message);
}

function handleAction(action, target) {
  switch (action) {
    case "profile-tab":
  setProfileTab(target.dataset.profileTab);
  break;
    case "log-training": trainingModal(); break;
    case "add-goal": goalModal(); break;
    case "edit-profile": profileModal(); break;
    case "close-modal": closeModal(); break;
    case "mobile-more": mobileMoreModal(); break;
    case "opportunity-detail": opportunityDetail(target.dataset.opportunityId); break;
    case "session-detail": sessionDetail(target.dataset.sessionId); break;
    case "toggle-save": {
      const id = target.dataset.opportunityId;
      state.savedOpportunityIds = state.savedOpportunityIds.includes(id)
        ? state.savedOpportunityIds.filter(x => x !== id)
        : [...state.savedOpportunityIds, id];
      saveAndRefresh(state.savedOpportunityIds.includes(id) ? "Opportunity saved." : "Removed from saved.");
      if (activeRoute === "discover") renderOpportunityGrid();
      break;
    }
    case "advance-goal": {
      const goal = state.goals.find(g => g.id === target.dataset.goalId);
      if (goal) { goal.progress = Math.min(100, goal.progress + 10); saveAndRefresh("Goal progress updated."); }
      break;
    }
      case "share-demo": {
  const sharedIdentity = getPublicIdentityText(state.profile);
  const shareData = {
    title: `${sharedIdentity} | NextStage`,
    text: `${sharedIdentity} — ${state.profile.headline}`,
    url: location.href
  };

  if (navigator.share) {
    navigator.share(shareData).catch(() => {});
  } else {
    navigator.clipboard?.writeText(`${shareData.text}\n${shareData.url}`)
      .then(() => showToast("Prototype profile share text copied."));
  }

  break;
}
    case "prototype-contact":
  showToast("Prototype only – no real message was sent.");
  break;

case "prototype-note":
  showToast("Prototype only – private note workflow is not connected yet.");
  break;

case "export-data":
  exportState(state);
  showToast("Demo data exported.");
  break;

case "reset-data": {
  if (confirm("Reset all local Prototype V1 changes on this browser?")) {
    state = resetState();
    renderRoute(activeRoute);
    showToast("Prototype reset.");
  }
  break;
}
      case "account-signout": {
        signOutLocalAccount();
        activeRoute = "dashboard";
        applyAuthGate();
  break;
}
    case "install-app": triggerInstall(); break;
  }
}

function bindGlobalEvents() {
  document.addEventListener("click", event => {
    const authTab = event.target.closest("[data-auth-view]");
if (authTab) {
  setAuthView(authTab.dataset.authView);
  return;
}
        const profileTab = event.target.closest("[data-profile-tab]");
    
    const routeButton = event.target.closest("[data-route]");
   if (routeButton) {
  setRoute(routeButton.dataset.route);
  if (!$("#modalBackdrop").hidden) closeModal();
  return;
}
    const actionButton = event.target.closest("[data-action]");
    if (actionButton) { handleAction(actionButton.dataset.action, actionButton); return; }
  });

  document.addEventListener("input", event => {
  if (event.target.matches("#opportunitySearch")) renderOpportunityGrid();

  const counter = event.target.nextElementSibling;

if (counter?.classList.contains("char-counter")) {
  counter.textContent = `${event.target.value.length} / ${event.target.maxLength}`;
}    
});
  
  document.addEventListener("change", event => {
    if (event.target.matches("#opportunityTypeFilter")) renderOpportunityGrid();
  });

  document.addEventListener("submit", event => {
      if (event.target.id === "createAccountForm") {
    handleCreateAccount(event);
    return;
  }

  if (event.target.id === "signInForm") {
    handleSignIn(event);
    return;
  }
    if (event.target.id === "trainingForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const minutes = Number(form.get("minutes"));
      const trueTouchMinutes = Math.min(minutes, Number(form.get("trueTouchMinutes")));
      state.sessions.unshift({
        id: `s${Date.now()}`,
        date: form.get("date"), type: form.get("type"), minutes, trueTouchMinutes,
        focus: form.get("focus"), notes: form.get("notes") || ""
      });
      
      state.development.totalHours = Math.round((state.development.totalHours + minutes / 60) * 100) / 100;
      state.development.trueTouchHours = Math.round((state.development.trueTouchHours + trueTouchMinutes / 60) * 100) / 100;
      state.development.currentWeekHours = Math.round((state.development.currentWeekHours + minutes / 60) * 100) / 100;
      state.weeklyHours[state.weeklyHours.length - 1].hours = state.development.currentWeekHours;
      saveState(state); closeModal(); renderRoute(activeRoute); showToast("Training session logged.");
    }

    if (event.target.id === "goalForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      state.goals.unshift({ id: `g${Date.now()}`, title: form.get("title"), target: form.get("target"), progress: Number(form.get("progress")), detail: form.get("detail") || "No progress note yet" });
      saveState(state); closeModal(); renderRoute(activeRoute); showToast("Goal added.");
    }

    if (event.target.id === "profileForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      for (const key of ["firstName", "lastName", "displayName", "username", "publicIdentityMode", "nameFormat", "headline", "city", "region", "country", "primaryPosition", "secondaryPosition", "bio"]) state.profile[key] = form.get(key);
      state.profile.initials = `${state.profile.firstName?.[0] || ""}${state.profile.lastName?.[0] || ""}`.toUpperCase();
      state.profile.profileCompletion = Math.min(100, Math.max(60, state.profile.profileCompletion + 2));
      saveState(state); closeModal(); renderRoute(activeRoute); showToast("Demo profile updated.");
    }
  });

  $("#closeModalButton").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", event => { if (event.target === $("#modalBackdrop")) closeModal(); });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && !$("#modalBackdrop").hidden) closeModal(); });
  $("#quickAddButton").addEventListener("click", trainingModal);
  $("#avatarButton").addEventListener("click", () => setRoute("profile"));
  $("#notificationButton").addEventListener("click", () => showToast("Prototype notification center: no new alerts."));
  $("#installButton").addEventListener("click", triggerInstall);
}

async function triggerInstall() {
  if (!installPrompt) {
    showToast("Use your browser's Add to Home Screen / Install app option.");
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("#installButton").hidden = true;
}

function setupPwa() {
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    $("#installButton").hidden = false;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    $("#installButton").hidden = true;
    showToast("NextStage installed.");
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(error => console.warn("Service worker registration failed", error)));
  }
}

function initialize() {
  bindGlobalEvents();
  setupPwa();
  applyAuthGate();
if (isPrototypeSignedIn()) setRoute("dashboard");
}

initialize();
