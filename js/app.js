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

function formatExperienceDate(value) {
  if (!value) return "Not set";
  if (value === "Present") return "Present";

  const [year, month] = value.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric"
  }).format(date);
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
      <button
    class="tab"
    type="button"
    data-action="profile-tab"
    data-profile-tab="all"
>
  View All
</button>
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

 <div class="profile-tab-panel" data-profile-panel="experience" hidden>

  <div class="stat-grid">
    <div class="stat-card">
      <span class="label">EXPERIENCE ENTRIES</span>
      <strong>${state.experiences.length}</strong>
      <small>Recorded experiences</small>
    </div>

    <div class="stat-card">
      <span class="label">CURRENT EXPERIENCES</span>
      <strong>${state.experiences.filter(item => item.endDate === "Present").length}</strong>
      <small>Currently active</small>
    </div>

    <div class="stat-card">
      <span class="label">EXPERIENCE TYPES</span>
      <strong>${new Set(state.experiences.map(item => item.type)).size}</strong>
      <small>Different pathways</small>
    </div>

    <div class="stat-card">
      <span class="label">CURRENT LEVEL</span>
      <strong>${escapeHtml(p.experienceLevel)}</strong>
      <small>Player-reported level</small>
    </div>
  </div>

  <div class="section-space">

 <div class="card">
  <div class="card-header">
    <div>
      <h3>Experience timeline</h3>
      <p class="card-subtitle">
        Teams, leagues, training, open play, camps, programs, and other soccer experience.
      </p>
    </div>

    <button
      class="button primary small"
      type="button"
      data-action="add-experience"
    >
      ＋ Add experience
    </button>
  </div>

  <div class="simple-list">
        ${state.experiences.map(item => `
          <div class="simple-item">
            <div class="activity-icon">◎</div>

            <div class="activity-copy">
              <strong>${escapeHtml(item.title)}</strong>

              <span>
                ${escapeHtml(item.organization)} ·
                ${escapeHtml(item.type)}
              </span>

              <span>
                ${formatExperienceDate(item.startDate)}
                –
                ${formatExperienceDate(item.endDate)}
                ·
                ${escapeHtml(item.location)}
              </span>

              <span>
                ${escapeHtml(item.role)} ·
                ${escapeHtml(item.level)}
              </span>

              <p class="bio" style="margin:8px 0 0;">
                ${escapeHtml(item.description)}
              </p>
            </div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="passport-support-grid">

      <div class="card">
        <div class="card-header">
          <div>
            <h3>Player experience profile</h3>
            <p class="card-subtitle">
              Current soccer background and availability.
            </p>
          </div>
        </div>

        <div class="profile-info-grid">
          <div class="info-cell">
            <span>Primary position</span>
            <strong>${escapeHtml(p.primaryPosition)}</strong>
          </div>

          <div class="info-cell">
            <span>Secondary position</span>
            <strong>${escapeHtml(p.secondaryPosition)}</strong>
          </div>

          <div class="info-cell">
            <span>Dominant foot</span>
            <strong>${escapeHtml(p.dominantFoot)}</strong>
          </div>

          <div class="info-cell">
            <span>Experience level</span>
            <strong>${escapeHtml(p.experienceLevel)}</strong>
          </div>
        </div>
      </div>

      <div class="card">
        <h3>Availability</h3>

        <p class="bio section-space">
          ${escapeHtml(p.availability)}
        </p>
      </div>

      <div class="card">
        <h3>Experience can take different paths</h3>

        <p class="bio section-space">
          NextStage is designed to document traditional and nontraditional
          soccer experience, including teams, leagues, schools, clubs,
          academies, camps, clinics, training programs, pickup or open play,
          independent development, and other meaningful playing experience.
        </p>
      </div>

    </div>

  </div>

</div>

     <div class="profile-tab-panel" data-profile-panel="achievements" hidden>

  <div class="stat-grid">

    <div class="stat-card">
      <span class="label">ACHIEVEMENTS RECORDED</span>
      <strong>${state.achievements.length}</strong>
      <small>Documented accomplishments</small>
    </div>

    <div class="stat-card">
      <span class="label">ACHIEVEMENT TYPES</span>
      <strong>${new Set(state.achievements.map(item => item.type)).size}</strong>
      <small>Different categories</small>
    </div>

    <div class="stat-card">
      <span class="label">MILESTONES</span>
      <strong>${state.achievements.filter(item => item.type === "Milestone").length}</strong>
      <small>Development milestones</small>
    </div>

    <div class="stat-card">
      <span class="label">LATEST RECORDED</span>
      <strong>${
        state.achievements.length
          ? formatDate(
              [...state.achievements]
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
                .date
            )
          : "None"
      }</strong>
      <small>Most recent achievement</small>
    </div>

  </div>

  <div class="section-space">

    <div class="card">
    <div class="card-header">
  <div>
    <h3>Achievement timeline</h3>
    <p class="card-subtitle">
      Milestones, awards, certifications, selections, completed goals,
      and other accomplishments.
    </p>
  </div>

  <button
    class="button primary small"
    type="button"
    data-action="add-achievement"
  >
    ＋ Add achievement
  </button>
</div>

<div class="simple-list">
        ${[...state.achievements]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(item => `
            <div class="simple-item">
              <div class="activity-icon">★</div>

             <div class="activity-copy">
  <strong>${escapeHtml(item.title)}</strong>

  <span>
    ${escapeHtml(item.type)} · ${formatDate(item.date)}
  </span>

  ${item.organization ? `
    <span>${escapeHtml(item.organization)}</span>
  ` : ""}

  ${item.description ? `
    <p class="bio" style="margin:8px 0 0;">
      ${escapeHtml(item.description)}
    </p>
  ` : ""}
</div>
            </div>
          `).join("")}
      </div>
    </div>

    <div class="passport-support-grid">

      <div class="card">
        <h3>Achievement categories</h3>

        <p class="bio section-space">
          NextStage can be used to document different kinds of
          accomplishments instead of treating every athlete's progress
          as the same path.
        </p>

        <div class="tag-row section-space">
          <span class="tag green">Milestones</span>
          <span class="tag blue">Awards</span>
          <span class="tag">Certifications</span>
          <span class="tag">Selections</span>
          <span class="tag">Completed goals</span>
          <span class="tag">Other accomplishments</span>
        </div>
      </div>

      <div class="card">
        <h3>Future verification</h3>

        <p class="bio section-space">
          A future production version could distinguish athlete-entered
          achievements from accomplishments verified by organizations,
          coaches, leagues, schools, trainers, or other trusted sources.
        </p>
      </div>

      <div class="card">
        <h3>Your progress still counts</h3>

        <p class="bio section-space">
          Achievements do not need to be trophies or elite selections.
          Development milestones, completed goals, certifications,
          participation accomplishments, and meaningful personal progress
          can also be part of an athlete's story.
        </p>
      </div>

    </div>

  </div>

</div>

   <div class="profile-tab-panel" data-profile-panel="highlights" hidden>

  <div class="stat-grid">

    <div class="stat-card">
      <span class="label">HIGHLIGHTS</span>
      <strong>${state.highlights.length}</strong>
      <small>Featured moments</small>
    </div>

    <div class="stat-card">
      <span class="label">VIDEOS</span>
      <strong>${state.highlights.filter(item => item.mediaType === "Video").length}</strong>
      <small>Video highlights</small>
    </div>

    <div class="stat-card">
      <span class="label">PHOTOS</span>
      <strong>${state.highlights.filter(item => item.mediaType === "Photo").length}</strong>
      <small>Photo highlights</small>
    </div>

    <div class="stat-card">
      <span class="label">HIGHLIGHT TYPES</span>
      <strong>${new Set(state.highlights.map(item => item.type)).size}</strong>
      <small>Different categories</small>
    </div>

  </div>

  <div class="section-space">

    <div class="card">
     <div class="card-header">
  <div>
    <h3>Highlight collection</h3>
    <p class="card-subtitle">
      Videos, photos, match moments, training clips, milestones,
      and other featured parts of your journey.
    </p>
  </div>

  <button
    class="button primary small"
    type="button"
    data-action="add-highlight"
  >
    ＋ Add highlight
  </button>
</div>

      <div class="simple-list">

        ${[...state.highlights]
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map(item => `
            <div class="simple-item">

              <div class="activity-icon">
                ${item.mediaType === "Video" ? "▶" : "▧"}
              </div>

              <div class="activity-copy">

                <strong>${escapeHtml(item.title)}</strong>

                <span>
                  ${escapeHtml(item.mediaType)} ·
                  ${escapeHtml(item.type)} ·
                  ${formatDate(item.date)}
                </span>

                <span>
                  ${escapeHtml(item.source)}
                </span>

                <p class="bio" style="margin:8px 0 0;">
                  ${escapeHtml(item.description)}
                </p>

                ${item.url ? `
                  <div class="section-space">
                    <a
                      class="button blue small"
                      href="${escapeHtml(item.url)}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open highlight ↗
                    </a>
                  </div>
                ` : `
                  <div class="section-space">
                    <span class="tag">
                      Prototype media placeholder
                    </span>
                  </div>
                `}

              </div>

            </div>
          `).join("")}

      </div>
    </div>

    <div class="passport-support-grid">

      <div class="card">
        <h3>Highlight categories</h3>

        <p class="bio section-space">
          Athletes can use Highlights to feature different parts of their
          development and playing journey.
        </p>

        <div class="tag-row section-space">
          <span class="tag green">Training</span>
          <span class="tag blue">Games</span>
          <span class="tag">Development</span>
          <span class="tag">Milestones</span>
          <span class="tag">Skills</span>
          <span class="tag">Achievements</span>
        </div>
      </div>

      <div class="card">
        <h3>Media in Prototype V1</h3>

        <p class="bio section-space">
          Prototype V1 stores highlight information and optional external
          links rather than uploading large video or photo files directly
          into the browser.
        </p>
      </div>

      <div class="card">
        <h3>Athlete-controlled presentation</h3>

        <p class="bio section-space">
          Highlights are intended to help athletes choose the moments that
          best represent their development, experience, progress, and
          accomplishments instead of automatically exposing everything
          they record.
        </p>
      </div>

    </div>

  </div>

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

 const showAll = tabName === "all";

$$("[data-profile-panel]", profileView).forEach(panel => {
  panel.hidden =
    !showAll &&
    panel.dataset.profilePanel !== tabName;
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

function highlightModal() {
  const now = new Date();
  const today =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")}`;

  openModal({
    eyebrow: "Athlete Passport",
    title: "Add highlight",
    body: `
      <form id="highlightForm">
        <div class="form-grid">

          <div class="field">
            <label>Highlight type *</label>
            <select name="type" required>
              <option value="">Choose type</option>
              <option>Training</option>
              <option>Game</option>
              <option>Development</option>
              <option>Milestone</option>
              <option>Skill</option>
              <option>Achievement</option>
              <option>Other</option>
            </select>
          </div>

          <div class="field">
            <label>Media type *</label>
            <select name="mediaType" required>
              <option value="">Choose media</option>
              <option>Video</option>
              <option>Photo</option>
            </select>
          </div>

          <div class="field full">
            <label>Highlight title *</label>
            <input
              name="title"
              maxlength="120"
              placeholder="Example: First Adult League Goal"
              required
            />
          </div>

          <div class="field">
            <label>Date *</label>
            <input
              name="date"
              type="date"
              value="${today}"
              required
            />
          </div>

          <div class="field">
            <label>Source</label>
            <input
              name="source"
              maxlength="100"
              placeholder="Example: Adult league match"
            />
          </div>

          <div class="field full">
            <label>External media link</label>
            <input
              name="url"
              type="url"
              maxlength="500"
              placeholder="https://..."
            />
            <small>
              Optional. Prototype V1 links to external media instead of uploading large files.
            </small>
          </div>

          <div class="field full">
            <label>Description *</label>
            <textarea
              name="description"
              maxlength="500"
              placeholder="Describe what this highlight shows and why it matters."
              required
            ></textarea>
          </div>

        </div>

        <div class="form-actions">
          <button
            type="button"
            class="button secondary"
            data-action="close-modal"
          >
            Cancel
          </button>

          <button
            class="button primary"
            type="submit"
          >
            Add highlight
          </button>
        </div>
      </form>`
  });
}

function achievementModal() {
  const now = new Date();
  const today =
    `${now.getFullYear()}-` +
    `${String(now.getMonth() + 1).padStart(2, "0")}-` +
    `${String(now.getDate()).padStart(2, "0")}`;

  openModal({
    eyebrow: "Athlete Passport",
    title: "Add achievement",
    body: `
      <form id="achievementForm">
        <div class="form-grid">

          <div class="field">
            <label>Achievement type *</label>
            <select name="type" required>
              <option value="">Choose type</option>
              <option>Milestone</option>
              <option>Award</option>
              <option>Certification</option>
              <option>Selection</option>
              <option>Completed Goal</option>
              <option>Consistency</option>
              <option>Profile</option>
              <option>Participation</option>
              <option>Recognition</option>
              <option>Other</option>
            </select>
          </div>

          <div class="field">
            <label>Date *</label>
            <input
              name="date"
              type="date"
              value="${today}"
              required
            />
          </div>

          <div class="field full">
            <label>Achievement title *</label>
            <input
              name="title"
              maxlength="120"
              placeholder="Example: Completed First Adult League Season"
              required
            />
          </div>

          <div class="field full">
            <label>Organization or source</label>
            <input
              name="organization"
              maxlength="100"
              placeholder="Example: NextStage milestone, league, club, school, trainer"
            />
          </div>

          <div class="field full">
            <label>Details</label>
            <textarea
              name="description"
              maxlength="500"
              placeholder="Optional details about what this achievement represents."
            ></textarea>
          </div>

        </div>

        <div class="notice info section-space">
          Prototype V1 achievements are athlete-entered and are not independently verified.
        </div>

        <div class="form-actions">
          <button
            type="button"
            class="button secondary"
            data-action="close-modal"
          >
            Cancel
          </button>

          <button
            class="button primary"
            type="submit"
          >
            Add achievement
          </button>
        </div>
      </form>`
  });
}

function experienceModal() {
  openModal({
    eyebrow: "Athlete Passport",
    title: "Add experience",
    body: `
      <form id="experienceForm">
        <div class="form-grid">

          <div class="field">
            <label>Experience type *</label>
            <select name="type" required>
              <option value="">Choose type</option>
              <option>Team</option>
              <option>Club</option>
              <option>League</option>
              <option>School</option>
              <option>Academy</option>
              <option>Training Program</option>
              <option>Camp</option>
              <option>Clinic</option>
              <option>Open Play</option>
              <option>Pickup</option>
              <option>Tournament</option>
              <option>Independent Development</option>
              <option>Other</option>
            </select>
          </div>

          <div class="field">
            <label>Role *</label>
            <input
              name="role"
              maxlength="60"
              value="Player"
              required
            />
          </div>

          <div class="field full">
            <label>Experience title *</label>
            <input
              name="title"
              maxlength="100"
              placeholder="Example: Adult Indoor League"
              required
            />
          </div>

          <div class="field full">
            <label>Organization *</label>
            <input
              name="organization"
              maxlength="100"
              placeholder="Example: West Michigan Soccer Club"
              required
            />
          </div>

          <div class="field">
            <label>Location</label>
            <input
              name="location"
              maxlength="100"
              placeholder="Example: Grand Rapids, MI"
            />
          </div>

          <div class="field">
            <label>Level</label>
            <input
              name="level"
              maxlength="80"
              placeholder="Example: Recreational"
            />
          </div>

          <div class="field">
            <label>Start month *</label>
            <input
              name="startDate"
              type="month"
              required
            />
          </div>

          <div class="field">
            <label>End month</label>
            <input
              name="endDate"
              type="month"
            />
            <small>Leave blank if this experience is still current.</small>
          </div>

          <div class="field full">
            <label>Description *</label>
            <textarea
              name="description"
              maxlength="500"
              placeholder="Describe what you did, learned, or accomplished during this experience."
              required
            ></textarea>
          </div>

        </div>

        <div class="form-actions">
          <button
            type="button"
            class="button secondary"
            data-action="close-modal"
          >
            Cancel
          </button>

          <button
            class="button primary"
            type="submit"
          >
            Add experience
          </button>
        </div>
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
    case "add-experience": experienceModal(); break;
    case "add-achievement": achievementModal(); break;
    case "add-highlight": highlightModal(); break;
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

    if (event.target.id === "highlightForm") {
  event.preventDefault();

  const form = new FormData(event.target);
  const url = String(form.get("url") || "").trim();

  if (url && !/^https?:\/\//i.test(url)) {
    showToast("Highlight links must start with http:// or https://.");
    return;
  }

  state.highlights.unshift({
    id: `h${Date.now()}`,
    type: String(form.get("type") || ""),
    mediaType: String(form.get("mediaType") || ""),
    title: String(form.get("title") || ""),
    date: String(form.get("date") || ""),
    source: String(form.get("source") || "Athlete-added highlight"),
    description: String(form.get("description") || ""),
    url
  });

  saveState(state);
  closeModal();
  renderRoute(activeRoute);
  setProfileTab("highlights");
  showToast("Highlight added.");
  return;
}

    if (event.target.id === "achievementForm") {
  event.preventDefault();

  const form = new FormData(event.target);

  state.achievements.unshift({
    id: `a${Date.now()}`,
    title: String(form.get("title") || ""),
    type: String(form.get("type") || ""),
    date: String(form.get("date") || ""),
    organization: String(form.get("organization") || ""),
    description: String(form.get("description") || ""),
    verification: "Athlete-entered"
  });

  saveState(state);
  closeModal();
  renderRoute(activeRoute);
  setProfileTab("achievements");
  showToast("Achievement added.");
  return;
}

    if (event.target.id === "experienceForm") {
  event.preventDefault();

  const form = new FormData(event.target);

  state.experiences.unshift({
    id: `e${Date.now()}`,
    type: String(form.get("type") || ""),
    title: String(form.get("title") || ""),
    organization: String(form.get("organization") || ""),
    location: String(form.get("location") || "Location not listed"),
    startDate: String(form.get("startDate") || ""),
    endDate: String(form.get("endDate") || "") || "Present",
    role: String(form.get("role") || "Player"),
    level: String(form.get("level") || "Not specified"),
    description: String(form.get("description") || "")
  });

  saveState(state);
  closeModal();
  renderRoute(activeRoute);
  setProfileTab("experience");
  showToast("Experience added.");
  return;
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

/* ========================================================================== */
/* PROTOTYPE V1 TEST-BRANCH EXPANSION — ORIGINAL APP ABOVE IS PRESERVED       */
/* ========================================================================== */
{
/*
  NextStage Athletics Prototype V1 expansion layer.

  IMPORTANT PRESERVATION RULE:
  This module intentionally sits on top of the original Prototype V1 app.
  It does not replace js/app.js, js/data.js, js/storage.js, js/auth.js, or
  css/styles.css. The goal is to preserve the working athlete prototype and
  add the company website, account/role concepts, admin/backend prototype,
  daily inspiration, privacy gate, and cross-surface navigation around it.
*/

const EXPANSION_KEY = "nextstage-prototype-v1-expansion";
const CORE_STATE_KEY = "nextstage-prototype-v1";
const AUTH_KEY = "nextstage-prototype-auth-v1";
const SESSION_KEY = "nextstage-prototype-session-v1";
const TERMS_VERSION = "prototype-v1-2026-11";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const ACCOUNT_TYPES = [
  {
    id: "athlete",
    label: "Athlete",
    icon: "⚽",
    kind: "person",
    description: "Build a Passport, document development, discover opportunities, save inspiration, and control sharing.",
    permissions: ["Own Athlete Passport", "Development log", "Opportunity discovery", "Saved inspiration", "Sharing controls"]
  },
  {
    id: "parent-guardian",
    label: "Parent / Guardian",
    icon: "♡",
    kind: "person",
    description: "Support linked athletes with age-appropriate consent, privacy, schedules, and family controls.",
    permissions: ["Linked-athlete overview", "Consent controls", "Family privacy", "Shared reminders", "Relationship management"]
  },
  {
    id: "family",
    label: "Family",
    icon: "⌂",
    kind: "entity",
    description: "A shared family workspace for linked athletes and authorized adults without taking ownership away from the athlete.",
    permissions: ["Family dashboard", "Linked-athlete summaries", "Consent records", "Shared calendar concept", "Family membership preview"]
  },
  {
    id: "team",
    label: "Team",
    icon: "◫",
    kind: "entity",
    description: "A team workspace for roster roles, communication concepts, development context, and opportunity publishing.",
    permissions: ["Team profile", "Roster roles", "Team opportunities", "Staff permissions", "Organization allocation"]
  },
  {
    id: "club-organization",
    label: "Club / Organization",
    icon: "▦",
    kind: "entity",
    description: "Manage multiple teams, staff roles, organization capacity, opportunity listings, and organization-facing settings.",
    permissions: ["Organization profile", "Multiple teams", "Capacity allocation", "Staff roles", "Opportunity management"]
  },
  {
    id: "coach",
    label: "Coach",
    icon: "◉",
    kind: "person",
    description: "Work within authorized team or athlete contexts while keeping coach access separate from family access.",
    permissions: ["Assigned-team view", "Shared athlete data", "Development notes concept", "Opportunity posting", "Role-scoped access"]
  },
  {
    id: "trainer",
    label: "Trainer",
    icon: "↗",
    kind: "person",
    description: "Present training services, support athlete development, and manage trainer-facing opportunities.",
    permissions: ["Trainer profile", "Training opportunities", "Shared development context", "Availability", "Athlete-controlled access"]
  },
  {
    id: "scout-recruiter",
    label: "Scout / Recruiter",
    icon: "⌕",
    kind: "person",
    description: "Review athlete-controlled shared profiles and recruiting context without gaining unrestricted athlete data.",
    permissions: ["Shared Athlete Passport", "Saved prospects concept", "Recruiting notes concept", "Organization scope", "Consent-aware access"]
  },
  {
    id: "referee",
    label: "Referee / Official",
    icon: "◇",
    kind: "person",
    description: "Maintain an official profile and connect with leagues, tournaments, teams, and event opportunities.",
    permissions: ["Official profile", "Availability", "League connections", "Event opportunities", "Credential placeholders"]
  },
  {
    id: "league-tournament",
    label: "League / Tournament",
    icon: "▣",
    kind: "entity",
    description: "Prototype scheduling, event opportunities, participating organizations, officials, and public event information.",
    permissions: ["Event profile", "Team participation", "Official roles", "Opportunity publishing", "Public information"]
  },
  {
    id: "spectator-fan",
    label: "Spectator / Fan",
    icon: "☆",
    kind: "person",
    description: "Follow public teams, athletes, inspiration, and events without receiving private athlete information.",
    permissions: ["Public following", "Saved inspiration", "Public events", "Public profiles only", "No private youth access"]
  },
  {
    id: "agent",
    label: "Agent / Representative",
    icon: "◆",
    kind: "person",
    description: "Prototype representation workflows with explicit athlete authorization and role-limited access.",
    permissions: ["Representative profile", "Authorized athlete relationships", "Opportunity context", "Role verification placeholder", "Scoped access"]
  },
  {
    id: "school",
    label: "School / Educational Institution",
    icon: "▤",
    kind: "entity",
    description: "Represent school programs, teams, staff, recruiting contexts, and athlete opportunities.",
    permissions: ["Institution profile", "School teams", "Staff roles", "Opportunities", "Recruiting context"]
  },
  {
    id: "sponsor-partner",
    label: "Sponsor / Partner",
    icon: "✦",
    kind: "entity",
    description: "Prototype partnerships, sponsorship opportunities, community support, and organization relationships.",
    permissions: ["Partner profile", "Sponsorship concepts", "Partnership opportunities", "Organization connections", "Public visibility"]
  },
  {
    id: "staff-team-manager",
    label: "Staff / Team Manager",
    icon: "☷",
    kind: "person",
    description: "Handle assigned administrative duties inside a team or organization without inheriting unrelated permissions.",
    permissions: ["Assigned administrative tasks", "Roster operations concept", "Team logistics", "Role-specific settings", "Least-privilege access"]
  }
];

const ORGANIZATION_PLANS = [
  { name: "Starter 1", teams: 1, players: 25, coaches: 4, staff: 4, parents: 35, spectators: 100 },
  { name: "Starter 2", teams: 2, players: 45, coaches: 7, staff: 6, parents: 65, spectators: 175 },
  { name: "Community 1", teams: 4, players: 90, coaches: 12, staff: 10, parents: 130, spectators: 350 },
  { name: "Community 2", teams: 6, players: 140, coaches: 18, staff: 14, parents: 210, spectators: 550 },
  { name: "Club 1", teams: 10, players: 230, coaches: 28, staff: 22, parents: 340, spectators: 900 },
  { name: "Club 2", teams: 15, players: 360, coaches: 42, staff: 30, parents: 520, spectators: 1400 },
  { name: "Club 3", teams: 25, players: 600, coaches: 70, staff: 45, parents: 850, spectators: 2300 },
  { name: "Regional 1", teams: 40, players: 1000, coaches: 110, staff: 70, parents: 1400, spectators: 3800 },
  { name: "Regional 2", teams: 65, players: 1650, coaches: 175, staff: 105, parents: 2300, spectators: 6200 },
  { name: "Enterprise", teams: 100, players: 2600, coaches: 270, staff: 160, parents: 3600, spectators: 10000 },
  { name: "Max", teams: "Custom", players: "Custom", coaches: "Custom", staff: "Custom", parents: "Custom", spectators: "Custom" }
];

const PLAYER_MEMBERSHIPS = [
  { name: "Player Base", price: "Free", features: ["Profile and privacy controls", "Development goals and activity log", "Discover public opportunities"] },
  { name: "Player Development", price: "TBD", features: ["Everything in Base", "Expanded progress summaries", "Downloadable development history"] },
  { name: "Player Plus", price: "TBD", features: ["Everything in Development", "More profile customization", "Saved opportunity alerts concept"] }
];

const FAMILY_MEMBERSHIPS = [
  { name: "Family Base", price: "Free", features: ["Link guardian and athlete accounts", "Manage consent and privacy settings", "View shared development summary"] },
  { name: "Family Connect", price: "TBD", features: ["Everything in Base", "Multiple linked athletes concept", "One family dashboard and calendar concept"] },
  { name: "Family Plus", price: "TBD", features: ["Everything in Connect", "Shared reminders and exports", "Additional linked-athlete capacity concept"] }
];

const SEED_INSPIRATION = [
  {
    id: "daily-01",
    title: "Your path still counts",
    body: "Your development does not become less real because it started later, moved slower, or looks different from somebody else's path.",
    category: "Confidence",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-02",
    title: "One mistake is one moment",
    body: "A mistake can change the next decision you make, but it does not get to decide what kind of athlete you are becoming.",
    category: "Mistakes",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-03",
    title: "Beginners belong here too",
    body: "Being new is not something to hide. It is simply the first visible stage of becoming more capable.",
    category: "Beginners",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-04",
    title: "Encouragement is part of development",
    body: "Good development is not only technical. Confidence, belonging, patience, and someone willing to build you up matter too.",
    category: "Teamwork",
    sourceType: "Founder Note",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-05",
    title: "Build one another up",
    body: "A faith-centered reminder inspired by 1 Thessalonians 5:11: encourage one another and help each other grow.",
    category: "Faith & Values",
    sourceType: "Scripture Theme",
    attribution: "1 Thessalonians 5:11",
    faith: true
  },
  {
    id: "daily-06",
    title: "A hard session can still be progress",
    body: "Not every practice needs to feel great to teach you something. Sometimes the work is learning how to keep going when it does not feel easy.",
    category: "Resilience",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-07",
    title: "You are more than today's performance",
    body: "Your value to a team, family, or community cannot be reduced to one score, one mistake, one tryout, or one bad day.",
    category: "Confidence",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-08",
    title: "Keep the joy in the game",
    body: "Improvement matters, but so does remembering why you wanted to play in the first place.",
    category: "Joy",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-09",
    title: "Ask for the next chance",
    body: "When something goes wrong, look for the next useful action: recover, communicate, learn, and get involved again.",
    category: "Mistakes",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-10",
    title: "Different does not mean behind",
    body: "A nontraditional route can still produce discipline, relationships, confidence, knowledge, and a meaningful place in sport.",
    category: "Beginners",
    sourceType: "Founder Note",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-11",
    title: "Be the teammate who notices",
    body: "Sometimes leadership is seeing who is discouraged and choosing to say something that helps them stay in the game.",
    category: "Leadership",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-12",
    title: "Progress can be quiet",
    body: "Cleaner first touches, better decisions, more confidence asking questions, and showing up again are all forms of progress.",
    category: "Development",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-13",
    title: "Rest can protect the reason you started",
    body: "Development should not require turning every moment into a performance test. Rest, perspective, and time away can protect joy.",
    category: "Wellbeing",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  },
  {
    id: "daily-14",
    title: "The next stage is not the final stage",
    body: "You do not need to know exactly how far you will go. You only need enough direction to take the next meaningful step.",
    category: "Motivation",
    sourceType: "NextStage Original",
    attribution: "NextStage Athletics",
    faith: false
  }
];

const SEED_STORIES = [
  {
    id: "story-founder",
    title: "Late start. Real development.",
    eyebrow: "Founder Story",
    summary: "NextStage grew partly from its founder's experience entering soccer later than many players and wanting development to count even when the path is unconventional.",
    body: "The idea is not that every athlete needs the same destination. It is that a person should be able to document effort, find realistic opportunities, learn, connect, and keep moving without pretending their journey began earlier than it did.",
    status: "NextStage Original"
  },
  {
    id: "story-confidence",
    title: "One mistake does not decide a player",
    eyebrow: "Confidence",
    summary: "A young player's difficult moment helped inspire a broader NextStage idea: athletes sometimes need useful encouragement as much as another statistic.",
    body: "This prototype intentionally removes identifying details. The lesson is simple: mistakes are part of learning, criticism can land hard, and the right words at the right time can help an athlete stay involved rather than disappear from the game.",
    status: "NextStage Original · identifying details withheld"
  },
  {
    id: "story-penrose",
    title: "Growing with the game",
    eyebrow: "Story Inspiration",
    summary: "The public football journey of brothers Jack and Max Penrose helped shape NextStage thinking about youth development, joy, family involvement, and the fact that progress is not only a highlight reel.",
    body: "For Prototype V1, this is an editorial concept rather than an endorsement or biography. Any future identifiable story would use verified public facts and appropriate permission, and would not present private thoughts, feelings, or conversations as established facts.",
    status: "Editorial concept · public facts/permission required before publication"
  },
  {
    id: "story-community-demo",
    title: "Still showing up",
    eyebrow: "Community Story Demo",
    summary: "A fictional prototype story about an athlete who did not make the first team they tried for, kept training, found a better-fit environment, and discovered that belonging mattered as much as status.",
    body: "This card demonstrates how community stories could be structured without using real participant data during Prototype V1 testing.",
    status: "Fictional demo"
  }
];

const DEFAULT_EXPANSION_STATE = {
  version: 1,
  terms: {
    acceptedVersion: null,
    acceptedAt: null
  },
  entryPreference: "auto",
  activeContext: "athlete",
  enabledContexts: ["athlete"],
  featured: {
    developmentCategory: "",
    experienceId: "",
    achievementId: "",
    highlightId: "",
    overviewChoice: "about"
  },
  socialLinks: [],
  familyLinks: [
    {
      id: "family-demo-1",
      athleteName: "Demo Youth Athlete",
      relationship: "Parent / Guardian",
      status: "Prototype linked",
      consent: "Demo consent record",
      visibility: "Family summary only"
    }
  ],
  entities: [
    {
      id: "entity-team-1",
      type: "team",
      name: "NextStage Demo FC",
      role: "Team Manager",
      members: 18,
      status: "Demo workspace"
    },
    {
      id: "entity-org-1",
      type: "club-organization",
      name: "NextStage Demo Organization",
      role: "Organization Admin",
      members: 64,
      status: "Demo workspace"
    }
  ],
  memberships: {
    player: "Player Base",
    family: "Family Base",
    organization: "Club 1"
  },
  inspiration: {
    savedIds: [],
    faithEnabled: false,
    preferredCategories: ["Confidence", "Development", "Resilience"],
    customItems: []
  },
  website: {
    pageStatuses: {
      home: "Published",
      about: "Published",
      athletes: "Published",
      families: "Published",
      organizations: "Published",
      coaches: "Published",
      inspiration: "Published",
      partnerships: "Published",
      sponsorships: "Published",
      careers: "Published",
      contact: "Published",
      safety: "Published"
    }
  },
  safetyQueue: [
    {
      id: "safe-1",
      type: "Demo youth privacy review",
      subject: "Sample profile visibility",
      priority: "High",
      status: "Open",
      note: "Fictional moderation item demonstrating a youth-safety review queue."
    },
    {
      id: "safe-2",
      type: "Demo opportunity report",
      subject: "Fictional listing review",
      priority: "Normal",
      status: "Open",
      note: "Shows how reported opportunity content could enter a human review workflow."
    }
  ],
  admin: {
    selectedPlan: "Club 1"
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaults(defaultValue, savedValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(savedValue) ? savedValue : clone(defaultValue);
  }

  if (defaultValue && typeof defaultValue === "object") {
    const source = savedValue && typeof savedValue === "object" && !Array.isArray(savedValue)
      ? savedValue
      : {};
    const result = {};

    Object.keys(defaultValue).forEach(key => {
      result[key] = mergeDefaults(defaultValue[key], source[key]);
    });

    Object.keys(source).forEach(key => {
      if (!(key in result)) result[key] = source[key];
    });

    return result;
  }

  return savedValue !== undefined ? savedValue : clone(defaultValue);
}

function loadExpansionState() {
  try {
    const raw = localStorage.getItem(EXPANSION_KEY);
    if (!raw) return clone(DEFAULT_EXPANSION_STATE);
    return mergeDefaults(DEFAULT_EXPANSION_STATE, JSON.parse(raw));
  } catch (error) {
    console.warn("Could not load NextStage V1 expansion state.", error);
    return clone(DEFAULT_EXPANSION_STATE);
  }
}

let expansion = loadExpansionState();
let currentMode = "company";
let currentCompanyPage = "home";
let currentAdminTab = "overview";
let currentPanel = null;
let currentPanelSub = "overview";
let pendingMode = "app";
let profileInjectionLock = false;

function saveExpansionState() {
  localStorage.setItem(EXPANSION_KEY, JSON.stringify(expansion));
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value = "") {
  const text = String(value || "").trim();
  if (!/^https?:\/\//i.test(text)) return "";
  return text.replaceAll('"', "%22");
}

function getCoreState() {
  try {
    const raw = localStorage.getItem(CORE_STATE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getLocalAccount() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function isSignedIn() {
  const account = getLocalAccount();
  if (!account) return false;

  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    return Boolean(session && session.signedIn === true && session.accountId === account.id);
  } catch {
    return false;
  }
}

function isoToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function getDayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

function getAllInspiration() {
  const custom = expansion.inspiration.customItems.map(item => ({
    faith: false,
    ...item
  }));
  return [...custom, ...SEED_INSPIRATION];
}

function getPublishedCustomInspiration() {
  const today = isoToday();
  return expansion.inspiration.customItems
    .filter(item => {
      if (item.status === "Published") return true;
      return item.status === "Scheduled" && item.publishDate && item.publishDate <= today;
    })
    .sort((a, b) => String(b.publishDate || "").localeCompare(String(a.publishDate || "")));
}

function getDailyInspiration({ publicView = false } = {}) {
  const custom = getPublishedCustomInspiration();
  const faithAllowed = publicView ? false : expansion.inspiration.faithEnabled;

  if (custom.length) {
    const eligibleCustom = custom.filter(item => faithAllowed || !item.faith);
    if (eligibleCustom.length) return eligibleCustom[0];
  }

  const eligible = SEED_INSPIRATION.filter(item => faithAllowed || !item.faith);
  return eligible[getDayOfYear() % eligible.length];
}

function contextDefinition(id = expansion.activeContext) {
  return ACCOUNT_TYPES.find(item => item.id === id) || ACCOUNT_TYPES[0];
}

function mountExpansionRoot() {
  let root = $("#v1ExpansionRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "v1ExpansionRoot";
    document.body.appendChild(root);
  }

  root.innerHTML = `
    <section class="v1-company-shell" id="v1CompanyShell" hidden>
      <header class="v1-company-header">
        <button class="v1-brand-button" type="button" data-v1-company-page="home" aria-label="NextStage home">
          <span class="v1-brand-mark">NS</span>
          <span><strong>NextStage</strong><small>Athletics</small></span>
        </button>

        <nav class="v1-company-nav" aria-label="Company website">
          <button type="button" data-v1-company-page="about">About</button>
          <button type="button" data-v1-company-page="athletes">Athletes</button>
          <button type="button" data-v1-company-page="families">Families</button>
          <button type="button" data-v1-company-page="organizations">Organizations</button>
          <button type="button" data-v1-company-page="coaches">Coaches & Trainers</button>
          <button type="button" data-v1-company-page="inspiration">Stories & Inspiration</button>
        </nav>

        <div class="v1-company-actions">
          <button class="v1-button ghost-dark" type="button" data-v1-action="open-admin">Admin Prototype</button>
          <button class="v1-button primary" type="button" data-v1-action="open-app">Open App</button>
        </div>
      </header>

      <main id="v1CompanyMain" class="v1-company-main"></main>
      <footer class="v1-company-footer" id="v1CompanyFooter"></footer>
    </section>

    <section class="v1-admin-shell" id="v1AdminShell" hidden>
      <aside class="v1-admin-sidebar">
        <div class="v1-admin-brand">
          <span class="v1-brand-mark">NS</span>
          <div><strong>NextStage Backend</strong><small>Prototype V1 admin</small></div>
        </div>
        <nav id="v1AdminNav"></nav>
        <div class="v1-admin-sidebar-actions">
          <button type="button" class="v1-button secondary full" data-v1-action="open-company">Company Website</button>
          <button type="button" class="v1-button secondary full" data-v1-action="open-app">Account App</button>
        </div>
      </aside>
      <main class="v1-admin-main">
        <header class="v1-admin-topbar">
          <div>
            <span class="v1-kicker">Internal prototype</span>
            <strong>NextStage Operations & Administration</strong>
          </div>
          <span class="v1-demo-chip">LOCAL DEMO ONLY</span>
        </header>
        <div id="v1AdminMain"></div>
      </main>
    </section>

    <div class="v1-privacy-backdrop" id="v1PrivacyGate" hidden>
      <section class="v1-privacy-card" role="dialog" aria-modal="true" aria-labelledby="v1PrivacyTitle">
        <span class="v1-kicker">Before entering the account prototype</span>
        <h2 id="v1PrivacyTitle">Privacy, safety & Prototype Terms</h2>
        <p>
          NextStage Prototype V1 stores prototype account and product data locally in this browser/device.
          It does not transmit this prototype data to a NextStage-controlled production backend.
        </p>
        <div class="v1-privacy-grid">
          <article>
            <strong>Youth-first design</strong>
            <p>Do not enter real sensitive information about minors. Production youth accounts would require dedicated age, guardian, consent, moderation, retention, and jurisdiction-specific review.</p>
          </article>
          <article>
            <strong>Prototype, not legal compliance</strong>
            <p>This interface demonstrates product intentions. It does not claim that a future production service automatically satisfies every U.S., Canadian, EU/EEA, or other legal requirement.</p>
          </article>
          <article>
            <strong>Local-only limitations</strong>
            <p>There is no real backend, billing, identity verification, direct messaging, background screening, or cross-device account synchronization in V1.</p>
          </article>
          <article>
            <strong>Public repository caution</strong>
            <p>Never place passwords, API keys, private addresses, financial information, private schedules, or sensitive personal data in this public prototype.</p>
          </article>
        </div>
        <label class="v1-check-row">
          <input type="checkbox" id="v1TermsCheck" />
          <span>I understand Prototype V1 is a local demonstration and I will use fictional/demo or otherwise safe information.</span>
        </label>
        <label class="v1-check-row">
          <input type="checkbox" id="v1SafetyCheck" />
          <span>I understand youth safety, privacy, guardian authority, and legal requirements need production review before real youth accounts launch.</span>
        </label>
        <div class="v1-actions">
          <button class="v1-button secondary" type="button" data-v1-action="open-company">Return to company website</button>
          <button class="v1-button primary" type="button" data-v1-action="accept-terms">Accept & Continue</button>
        </div>
      </section>
    </div>

    <div class="v1-panel-backdrop" id="v1PanelBackdrop" hidden>
      <section class="v1-panel" role="dialog" aria-modal="true" aria-labelledby="v1PanelTitle">
        <header class="v1-panel-header">
          <div>
            <span class="v1-kicker">NextStage Prototype V1</span>
            <h2 id="v1PanelTitle">Panel</h2>
          </div>
          <button type="button" class="v1-close" data-v1-action="close-panel" aria-label="Close">×</button>
        </header>
        <div id="v1PanelBody" class="v1-panel-body"></div>
      </section>
    </div>

    <button type="button" class="v1-mobile-hub" id="v1MobileHub" data-v1-action="open-hub" hidden aria-label="Open NextStage hub">NS</button>
  `;
}

function renderCompanyFooter() {
  const footer = $("#v1CompanyFooter");
  if (!footer) return;

  footer.innerHTML = `
    <div>
      <strong>NextStage Athletics · Prototype V1</strong>
      <p>One ecosystem for development, opportunity, organizations, families, inspiration, and the people who help athletes keep moving.</p>
    </div>
    <div class="v1-footer-links">
      <button type="button" data-v1-company-page="partnerships">Partnerships</button>
      <button type="button" data-v1-company-page="sponsorships">Sponsorships</button>
      <button type="button" data-v1-company-page="careers">Careers</button>
      <button type="button" data-v1-company-page="contact">Contact</button>
      <button type="button" data-v1-company-page="safety">Safety & Privacy</button>
    </div>
  `;
}

function companyHero(title, copy, actions = "") {
  return `
    <section class="v1-company-hero">
      <div>
        <span class="v1-kicker light">NextStage Athletics</span>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(copy)}</p>
        ${actions ? `<div class="v1-hero-actions">${actions}</div>` : ""}
      </div>
      <div class="v1-hero-orbit" aria-hidden="true">
        <span>Develop</span><span>Connect</span><span>Discover</span><span>Inspire</span>
      </div>
    </section>
  `;
}

function dailyInspirationCard(item, { account = false } = {}) {
  const saved = expansion.inspiration.savedIds.includes(item.id);
  return `
    <article class="v1-inspiration-card">
      <div class="v1-card-topline">
        <span class="v1-pill">${escapeHtml(item.category || "Inspiration")}</span>
        <span class="v1-muted">${escapeHtml(item.sourceType || "NextStage")}</span>
      </div>
      <h3>${escapeHtml(item.title)}</h3>
      <blockquote>${escapeHtml(item.body)}</blockquote>
      <p class="v1-attribution">— ${escapeHtml(item.attribution || "NextStage Athletics")}</p>
      ${account ? `
        <div class="v1-actions compact">
          <button type="button" class="v1-button ${saved ? "soft" : "secondary"}" data-v1-action="toggle-inspiration-save" data-inspiration-id="${escapeHtml(item.id)}">${saved ? "♥ Saved" : "♡ Save"}</button>
        </div>
      ` : ""}
    </article>
  `;
}

function companyHome() {
  const daily = getDailyInspiration({ publicView: true });
  return `
    ${companyHero(
      "Find the next stage of your athletic journey.",
      "A prototype ecosystem for athletes, families, coaches, teams, organizations, scouts, trainers, officials, partners, and the people who help sport stay meaningful.",
      `<button class="v1-button primary large" type="button" data-v1-action="open-app">Enter the App</button>
       <button class="v1-button light large" type="button" data-v1-company-page="about">Why NextStage?</button>`
    )}

    <section class="v1-company-section">
      <div class="v1-section-heading">
        <span class="v1-kicker">One platform · many paths</span>
        <h2>Development is bigger than a roster spot.</h2>
        <p>Prototype V1 connects the pieces athletes and sports communities usually have to track separately.</p>
      </div>
      <div class="v1-feature-grid four">
        <article class="v1-feature-card accent-green"><span>01</span><h3>Athlete Passport</h3><p>Development, experience, achievements, highlights, links, and athlete-controlled presentation.</p></article>
        <article class="v1-feature-card accent-blue"><span>02</span><h3>Opportunity</h3><p>Teams, training, leagues, officials, events, organizations, and other realistic pathways.</p></article>
        <article class="v1-feature-card accent-purple"><span>03</span><h3>Connected roles</h3><p>One identity can hold multiple roles while permissions stay scoped to the right relationship.</p></article>
        <article class="v1-feature-card accent-amber"><span>04</span><h3>Inspiration</h3><p>Daily encouragement, stories, quotes, values, and reminders worth coming back to.</p></article>
      </div>
    </section>

    <section class="v1-company-section v1-split-section">
      <div>
        <span class="v1-kicker">Today's inspiration</span>
        <h2>Sometimes the next step is hearing the right thing.</h2>
        <p>Daily Inspiration can be written or curated by NextStage staff, scheduled in the backend, and shown publicly or personalized inside accounts.</p>
        <button class="v1-button secondary" type="button" data-v1-company-page="inspiration">Explore Stories & Inspiration</button>
      </div>
      ${dailyInspirationCard(daily)}
    </section>

    <section class="v1-company-section">
      <div class="v1-section-heading">
        <span class="v1-kicker">Built for the whole ecosystem</span>
        <h2>Choose your perspective.</h2>
      </div>
      <div class="v1-audience-grid">
        ${ACCOUNT_TYPES.slice(0, 12).map(item => `
          <article class="v1-audience-card">
            <span>${item.icon}</span>
            <h3>${escapeHtml(item.label)}</h3>
            <p>${escapeHtml(item.description)}</p>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function companyAbout() {
  return `
    ${companyHero("Why NextStage exists.", "The idea starts with a simple problem: real athletic development does not always fit the conventional path, and the people who need a next step are not always the people already getting the most attention.")}
    <section class="v1-company-section v1-story-layout">
      <article class="v1-story-feature">
        <span class="v1-kicker">Founder story</span>
        <h2>Late start. Real development.</h2>
        <p>NextStage grew partly from its founder's experience entering soccer later than many athletes and asking a question that became bigger than one player's story: where does someone go when they want to develop, connect, and find realistic opportunities without pretending they followed the traditional route?</p>
        <p>The prototype is designed around progress, context, relationships, safety, and helping people identify a useful next stage—not around promising that everyone reaches the same destination.</p>
      </article>
      <div class="v1-principles-grid">
        <article><strong>Development over image</strong><p>Progress should be documentable even when it is still early, imperfect, or unconventional.</p></article>
        <article><strong>Opportunity over promises</strong><p>NextStage can help people discover pathways without claiming to guarantee teams, scholarships, careers, or recruiting outcomes.</p></article>
        <article><strong>Safety over growth</strong><p>Youth protections, consent, privacy, moderation, and least-privilege access should not become premium extras.</p></article>
        <article><strong>People over metrics</strong><p>Statistics matter, but confidence, belonging, encouragement, joy, and healthy relationships matter too.</p></article>
      </div>
    </section>
  `;
}

function companyAudiencePage(type) {
  const copy = {
    athletes: ["Athletes", "Build a development record that reflects the path you are actually on.", ["Athlete Passport", "Development tracking", "Experience & achievements", "Highlights & links", "Opportunity discovery", "Daily Inspiration"]],
    families: ["Families", "Support athletes without turning a family account into ownership of an athlete's identity.", ["Guardian relationships", "Consent & privacy concept", "Linked-athlete summaries", "Family membership preview", "Shared reminders concept", "Youth-first controls"]],
    organizations: ["Organizations", "Prototype team, club, school, league, tournament, and partner workspaces inside the same ecosystem.", ["Organization profiles", "Team allocation", "Role permissions", "Opportunity publishing", "Capacity plans", "Admin controls"]],
    coaches: ["Coaches & Trainers", "Work with athletes in the right context while keeping professional access separate from family or unrelated permissions.", ["Coach profiles", "Trainer profiles", "Shared athlete context", "Development notes concept", "Opportunities", "Role-scoped access"]]
  }[type];

  return `
    ${companyHero(copy[0], copy[1])}
    <section class="v1-company-section">
      <div class="v1-feature-grid three">
        ${copy[2].map((item, index) => `<article class="v1-feature-card"><span>${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(item)}</h3><p>Interactive Prototype V1 concept demonstrating how this capability fits into NextStage.</p></article>`).join("")}
      </div>
      <div class="v1-notice">Prototype V1 uses fictional/demo information and local browser storage. Production identity, permissions, youth safeguards, verification, billing, and data handling would require secure backend implementation and formal review.</div>
    </section>
  `;
}

function companyInspiration() {
  const daily = getDailyInspiration({ publicView: true });
  return `
    ${companyHero("Stories & Inspiration", "A place to return to when development is frustrating, confidence is low, somebody needs perspective, or a story is worth carrying forward.")}
    <section class="v1-company-section v1-split-section">
      <div>
        <span class="v1-kicker">Updated daily</span>
        <h2>Today's Inspiration</h2>
        <p>Prototype V1 changes the default message by date and lets the internal backend schedule new items written or curated by NextStage.</p>
      </div>
      ${dailyInspirationCard(daily)}
    </section>
    <section class="v1-company-section">
      <div class="v1-section-heading"><span class="v1-kicker">Stories behind the idea</span><h2>Development is personal.</h2></div>
      <div class="v1-story-grid">
        ${SEED_STORIES.map(story => `
          <article class="v1-story-card">
            <span class="v1-kicker">${escapeHtml(story.eyebrow)}</span>
            <h3>${escapeHtml(story.title)}</h3>
            <p>${escapeHtml(story.summary)}</p>
            <div class="v1-story-detail">${escapeHtml(story.body)}</div>
            <small>${escapeHtml(story.status)}</small>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="v1-company-section">
      <div class="v1-notice strong">Community stories involving identifiable youth would require appropriate sourcing, permission/guardian handling, and safety review before production publication. Prototype V1 can test the editorial structure without collecting real youth submissions.</div>
    </section>
  `;
}

function companySimplePage(page) {
  const pages = {
    partnerships: ["Partnerships", "Build relationships with organizations that can expand development, access, education, safety, community impact, and opportunity.", ["Community organizations", "Sports organizations", "Education partners", "Public-sector partnerships", "Nonprofit collaboration", "Technology/service partners"]],
    sponsorships: ["Sponsorships", "Prototype ways sponsors could support NextStage, athletes, organizations, programming, community initiatives, and future scholarship efforts.", ["Platform sponsorship", "Program sponsorship", "Community support", "Event support", "Scholarship concepts", "Brand partnership concepts"]],
    careers: ["Careers", "A future team will need people who understand sport, technology, safety, community, operations, design, and the humans behind the profiles.", ["Product & technology", "Trust & safety", "Partnerships", "Operations", "Community", "Marketing & content"]],
    contact: ["Contact", "Prototype contact destinations for athletes, families, organizations, partners, media, safety concerns, and general questions.", ["General questions", "Athlete & family support", "Organization support", "Partnerships", "Media", "Safety reports"]],
    safety: ["Safety & Privacy", "Youth protection, privacy, consent, moderation, and least-privilege access are product requirements—not optional extras.", ["Age-appropriate design", "Guardian relationships", "Privacy controls", "Moderation workflows", "Reporting", "Data minimization"]]
  };
  const content = pages[page] || pages.contact;

  return `
    ${companyHero(content[0], content[1])}
    <section class="v1-company-section">
      <div class="v1-feature-grid three">
        ${content[2].map((item, index) => `<article class="v1-feature-card"><span>${String(index + 1).padStart(2, "0")}</span><h3>${escapeHtml(item)}</h3><p>Prototype V1 placeholder showing where this company-facing function belongs.</p></article>`).join("")}
      </div>
      ${page === "safety" ? `<div class="v1-notice strong">This prototype does not claim production legal compliance. Real launch would require dedicated legal, privacy, security, safeguarding, retention, incident-response, and jurisdiction-specific review.</div>` : ""}
    </section>
  `;
}

function renderCompany(page = currentCompanyPage) {
  currentCompanyPage = page;
  const main = $("#v1CompanyMain");
  if (!main) return;

  const renderers = {
    home: companyHome,
    about: companyAbout,
    athletes: () => companyAudiencePage("athletes"),
    families: () => companyAudiencePage("families"),
    organizations: () => companyAudiencePage("organizations"),
    coaches: () => companyAudiencePage("coaches"),
    inspiration: companyInspiration,
    partnerships: () => companySimplePage("partnerships"),
    sponsorships: () => companySimplePage("sponsorships"),
    careers: () => companySimplePage("careers"),
    contact: () => companySimplePage("contact"),
    safety: () => companySimplePage("safety")
  };

  main.innerHTML = (renderers[page] || companyHome)();
  renderCompanyFooter();
  $$('[data-v1-company-page]', $("#v1CompanyShell")).forEach(button => {
    button.classList.toggle("active", button.dataset.v1CompanyPage === page);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function hideBaseSurfaces() {
  const auth = $("#authScreen");
  const app = $(".app-shell");
  if (auth) auth.hidden = true;
  if (app) app.hidden = true;
}

function hideExpansionSurfaces() {
  const company = $("#v1CompanyShell");
  const admin = $("#v1AdminShell");
  if (company) company.hidden = true;
  if (admin) admin.hidden = true;
}

function activateAuthSignIn() {
  const createForm = $("#createAccountForm");
  const signInForm = $("#signInForm");
  const createTab = $("#showCreateAccount");
  const signInTab = $("#showSignIn");
  const learnPanel = $("#v1AuthLearnPanel");
  const learnTab = $("#v1AuthLearnTab");

  if (!createForm || !signInForm) return;
  createForm.hidden = true;
  signInForm.hidden = false;
  createTab?.classList.remove("active");
  signInTab?.classList.add("active");
  if (learnPanel) learnPanel.hidden = true;
  learnTab?.classList.remove("active");
}

function showCompany(page = "home") {
  currentMode = "company";
  pendingMode = "company";
  hideBaseSurfaces();
  hideExpansionSurfaces();
  $("#v1PrivacyGate").hidden = true;
  $("#v1CompanyShell").hidden = false;
  $("#v1MobileHub").hidden = true;
  renderCompany(page);
}

function enterAppAfterGate() {
  currentMode = "app";
  hideExpansionSurfaces();
  $("#v1PrivacyGate").hidden = true;
  $("#v1MobileHub").hidden = false;

  const auth = $("#authScreen");
  const app = $(".app-shell");

  if (isSignedIn()) {
    auth.hidden = true;
    app.hidden = false;
  } else {
    app.hidden = true;
    auth.hidden = false;
    activateAuthSignIn();
  }

  injectAppControls();
  scheduleAppEnhancements();
}

function showApp() {
  pendingMode = "app";
  const accepted = expansion.terms.acceptedVersion === TERMS_VERSION;
  if (!accepted) {
    hideBaseSurfaces();
    hideExpansionSurfaces();
    $("#v1PrivacyGate").hidden = false;
    return;
  }
  enterAppAfterGate();
}

function showAdmin(tab = "overview") {
  currentMode = "admin";
  pendingMode = "admin";
  hideBaseSurfaces();
  hideExpansionSurfaces();
  $("#v1PrivacyGate").hidden = true;
  $("#v1AdminShell").hidden = false;
  $("#v1MobileHub").hidden = true;
  renderAdmin(tab);
}

function injectAuthLearnMore() {
  const tabs = $(".auth-tabs");
  if (!tabs || $("#v1AuthLearnTab")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "auth-tab";
  button.id = "v1AuthLearnTab";
  button.dataset.v1Action = "auth-learn";
  button.textContent = "Learn more";
  tabs.appendChild(button);

  const footnote = $(".auth-footnote");
  const panel = document.createElement("section");
  panel.id = "v1AuthLearnPanel";
  panel.className = "v1-auth-learn-panel";
  panel.hidden = true;
  panel.innerHTML = `
    <span class="v1-kicker">One account · multiple roles</span>
    <h3>What is this prototype account?</h3>
    <p>Prototype V1 demonstrates how one NextStage identity could support athlete, family, coach, trainer, scout, referee, staff, and organization contexts without requiring separate passwords for every role.</p>
    <div class="v1-mini-grid">
      <article><strong>Local only</strong><span>Account information stays in this browser/device.</span></article>
      <article><strong>Role scoped</strong><span>Being a guardian does not automatically expand coach access, and vice versa.</span></article>
      <article><strong>Youth aware</strong><span>Real youth launch would require production consent, privacy, moderation, and legal review.</span></article>
      <article><strong>One ecosystem</strong><span>The public company site and account app belong to the same installable PWA.</span></article>
    </div>
    <button type="button" class="v1-button secondary" data-v1-action="open-company">Visit company website</button>
  `;
  footnote?.insertAdjacentElement("beforebegin", panel);
  tabs.classList.add("v1-three-tabs");
}

function showAuthLearnMore() {
  const createForm = $("#createAccountForm");
  const signInForm = $("#signInForm");
  const panel = $("#v1AuthLearnPanel");
  if (!panel) return;

  createForm.hidden = true;
  signInForm.hidden = true;
  panel.hidden = false;
  $("#showCreateAccount")?.classList.remove("active");
  $("#showSignIn")?.classList.remove("active");
  $("#v1AuthLearnTab")?.classList.add("active");
}

function injectAppControls() {
  injectAuthLearnMore();

  const nav = $("#desktopNav");
  if (nav && !$("#v1DesktopInspiration")) {
    nav.insertAdjacentHTML("beforeend", `
      <button class="nav-item" id="v1DesktopInspiration" type="button" data-v1-action="open-inspiration"><span>✦</span>Inspiration</button>
      <button class="nav-item" id="v1DesktopAccount" type="button" data-v1-action="open-account"><span>◎</span>Account Center</button>
      <button class="nav-item" type="button" data-v1-action="open-company"><span>↔</span>Company Site</button>
      <button class="nav-item" type="button" data-v1-action="open-admin"><span>▦</span>Admin Demo</button>
    `);
  }

  const actions = $(".topbar-actions");
  if (actions && !$("#v1TopbarInspire")) {
    actions.insertAdjacentHTML("afterbegin", `
      <button class="icon-button" id="v1TopbarInspire" type="button" data-v1-action="open-inspiration" title="Daily Inspiration">✦</button>
      <button class="icon-button" id="v1TopbarHub" type="button" data-v1-action="open-hub" title="NextStage hub">NS</button>
    `);
  }
}

function scheduleAppEnhancements() {
  window.setTimeout(() => {
    injectDashboardInspiration();
    injectProfileEnhancements();
    injectSettingsExpansion();
  }, 80);
}

function injectDashboardInspiration() {
  const view = $("#view-dashboard");
  if (!view || !view.innerHTML || $("#v1DailyDashboard", view)) return;

  const daily = getDailyInspiration();
  const wrapper = document.createElement("div");
  wrapper.id = "v1DailyDashboard";
  wrapper.className = "v1-dashboard-inspiration section-space";
  wrapper.innerHTML = `
    <div class="card v1-dashboard-inspiration-card">
      <div>
        <span class="eyebrow">Daily Inspiration</span>
        <h3>${escapeHtml(daily.title)}</h3>
        <p>${escapeHtml(daily.body)}</p>
        <small>${escapeHtml(daily.attribution || "NextStage Athletics")} · ${escapeHtml(daily.category || "Inspiration")}</small>
      </div>
      <div class="card-actions">
        <button class="button purple small" type="button" data-v1-action="toggle-inspiration-save" data-inspiration-id="${escapeHtml(daily.id)}">${expansion.inspiration.savedIds.includes(daily.id) ? "♥ Saved" : "♡ Save"}</button>
        <button class="button blue small" type="button" data-v1-action="open-inspiration">Open Inspire</button>
      </div>
    </div>
  `;

  const notice = $(".notice.info.section-space", view);
  if (notice) notice.insertAdjacentElement("beforebegin", wrapper);
  else view.appendChild(wrapper);
}

function chooseCoreItem(items, id) {
  if (!Array.isArray(items) || !items.length) return null;
  return items.find(item => item.id === id) || items[0];
}

function getFeaturedSelections() {
  const core = getCoreState() || {};
  const categories = core.development?.categories || [];
  const selectedCategory = categories.find(item => item.name === expansion.featured.developmentCategory) || categories[0] || null;
  return {
    core,
    development: selectedCategory,
    experience: chooseCoreItem(core.experiences, expansion.featured.experienceId),
    achievement: chooseCoreItem(core.achievements, expansion.featured.achievementId),
    highlight: chooseCoreItem(core.highlights, expansion.featured.highlightId)
  };
}

function featureSummaryCard(label, title, copy, icon) {
  return `
    <article class="v1-feature-summary-card">
      <span class="v1-feature-summary-icon">${icon}</span>
      <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(title || "Not selected")}</strong><p>${escapeHtml(copy || "Choose an item to feature.")}</p></div>
    </article>
  `;
}

function injectProfileEnhancements() {
  if (profileInjectionLock) return;
  const view = $("#view-profile");
  if (!view || !view.innerHTML) return;
  profileInjectionLock = true;

  try {
    const { core, development, experience, achievement, highlight } = getFeaturedSelections();
    const overview = $('[data-profile-panel="overview"]', view);

    if (overview && !$("#v1FeaturedOverview", overview)) {
      const block = document.createElement("section");
      block.id = "v1FeaturedOverview";
      block.className = "v1-featured-overview v1-featured-summary";
      block.innerHTML = `
        <div class="v1-featured-heading">
          <div><span class="eyebrow">Player-selected Featured</span><h3>Featured from across your Passport</h3><p>Small summaries selected by the athlete. Full sections remain in their own tabs.</p></div>
          <button type="button" class="button navy small" data-v1-action="customize-featured">Customize Featured</button>
        </div>
        <div class="v1-feature-summary-grid">
          ${featureSummaryCard("Development", development?.name, development ? `${development.score}% prototype progress` : "Choose a development category.", "↗")}
          ${featureSummaryCard("Experience", experience?.title, experience ? `${experience.organization || "Experience"} · ${experience.level || "Level not listed"}` : "Choose an experience.", "◫")}
          ${featureSummaryCard("Achievement", achievement?.title, achievement ? `${achievement.type || "Achievement"}${achievement.date ? ` · ${achievement.date}` : ""}` : "Choose an achievement.", "★")}
          ${featureSummaryCard("Highlight", highlight?.title, highlight ? `${highlight.mediaType || "Media"} · ${highlight.type || "Highlight"}` : "Choose a highlight.", "▶")}
        </div>
      `;
      overview.insertAdjacentElement("afterbegin", block);
    }

    if (overview && !$("#v1SocialLinksCard", overview)) {
      const social = document.createElement("section");
      social.id = "v1SocialLinksCard";
      social.className = "card v1-social-links-card v1-featured-summary";
      const visibleLinks = expansion.socialLinks.filter(link => link.url);
      social.innerHTML = `
        <div class="card-header">
          <div><h3>Links & Socials</h3><p class="card-subtitle">Athlete-controlled links and visibility.</p></div>
          <button class="button blue small" type="button" data-v1-action="edit-social-links">Edit links</button>
        </div>
        ${visibleLinks.length ? `<div class="v1-social-link-list">${visibleLinks.map(link => `<a href="${safeUrl(link.url)}" target="_blank" rel="noopener noreferrer"><strong>${escapeHtml(link.platform)}</strong><span>${escapeHtml(link.visibility || "Public")}</span></a>`).join("")}</div>` : `<div class="v1-empty-mini">No links added yet. Add a website, YouTube, Instagram, TikTok, X, Threads, Facebook, or custom links.</div>`}
      `;
      overview.appendChild(social);
    }

    const overviewChoices = {
      about: core.profile?.bio,
      headline: core.profile?.headline,
      availability: core.profile?.availability
    };
    const overviewFeature = overviewChoices[expansion.featured.overviewChoice] || core.profile?.bio || core.profile?.headline || "Athlete overview";
    const panels = [
      ["development", "Featured from Overview", overviewFeature],
      ["experience", "Featured from Overview", overviewFeature],
      ["achievements", "Featured from Overview", overviewFeature],
      ["highlights", "Featured from Overview", overviewFeature]
    ];

    panels.forEach(([name, label, text]) => {
      const panel = $(`[data-profile-panel="${name}"]`, view);
      if (!panel || $(`.v1-overview-feature-${name}`, panel)) return;
      const item = document.createElement("div");
      item.className = `v1-cross-feature v1-featured-summary v1-overview-feature-${name}`;
      item.innerHTML = `<span class="eyebrow">${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong>`;
      panel.insertAdjacentElement("afterbegin", item);
    });

    updateViewAllFeatureVisibility();
  } finally {
    profileInjectionLock = false;
  }
}

function updateViewAllFeatureVisibility() {
  const view = $("#view-profile");
  if (!view) return;
  const showAll = $('[data-profile-tab="all"]', view)?.classList.contains("active");
  $$(".v1-featured-summary", view).forEach(item => {
    item.classList.toggle("v1-hidden-in-view-all", Boolean(showAll));
  });
}

function injectSettingsExpansion() {
  const view = $("#view-settings");
  if (!view || !view.innerHTML || $("#v1SettingsExpansion", view)) return;
  const card = document.createElement("section");
  card.id = "v1SettingsExpansion";
  card.className = "card section-space";
  card.innerHTML = `
    <div class="card-header"><div><h3>Prototype V1 ecosystem</h3><p class="card-subtitle">Company site, account roles, backend demo, privacy gate, and entry preference.</p></div></div>
    <div class="v1-settings-actions">
      <button class="button blue" type="button" data-v1-action="open-account">Account Center</button>
      <button class="button purple" type="button" data-v1-action="open-inspiration">Inspiration</button>
      <button class="button secondary" type="button" data-v1-action="open-company">Company Website</button>
      <button class="button navy" type="button" data-v1-action="open-admin">Admin Prototype</button>
    </div>
    <div class="v1-entry-setting">
      <label for="v1EntryPreference"><strong>Default entry</strong><span>Auto sends first-time visitors to the company website and established local account holders toward the app.</span></label>
      <select id="v1EntryPreference">
        <option value="auto" ${expansion.entryPreference === "auto" ? "selected" : ""}>Auto</option>
        <option value="company" ${expansion.entryPreference === "company" ? "selected" : ""}>Company website</option>
        <option value="app" ${expansion.entryPreference === "app" ? "selected" : ""}>Account app</option>
      </select>
    </div>
  `;
  view.appendChild(card);
}

function openPanel(kind, sub = "overview") {
  currentPanel = kind;
  currentPanelSub = sub;
  const backdrop = $("#v1PanelBackdrop");
  const title = $("#v1PanelTitle");
  const body = $("#v1PanelBody");
  if (!backdrop || !title || !body) return;

  title.textContent = kind === "inspiration" ? "Inspiration" : kind === "account" ? "Account Center" : "NextStage Hub";
  body.innerHTML = kind === "inspiration"
    ? renderInspirationPanel()
    : kind === "account"
      ? renderAccountPanel()
      : renderHubPanel();
  backdrop.hidden = false;
}

function closePanel() {
  $("#v1PanelBackdrop").hidden = true;
  currentPanel = null;
}

function renderHubPanel() {
  const active = contextDefinition();
  return `
    <div class="v1-panel-intro">
      <span class="v1-kicker">One ecosystem</span>
      <h3>Where do you want to go?</h3>
      <p>Current account context: <strong>${escapeHtml(active.label)}</strong>.</p>
    </div>
    <div class="v1-hub-grid">
      <button type="button" data-v1-action="open-inspiration"><span>✦</span><strong>Inspiration</strong><small>Daily message, stories, quotes, and saved items.</small></button>
      <button type="button" data-v1-action="open-account"><span>◎</span><strong>Account Center</strong><small>Roles, family links, organizations, memberships, and links.</small></button>
      <button type="button" data-v1-action="open-company"><span>↔</span><strong>Company Website</strong><small>Public NextStage website and Stories & Inspiration.</small></button>
      <button type="button" data-v1-action="open-admin"><span>▦</span><strong>Backend / Admin</strong><small>Internal content, roles, safety, organizations, and diagnostics.</small></button>
    </div>
  `;
}

function renderInspirationPanel() {
  const daily = getDailyInspiration();
  const all = getAllInspiration().filter(item => expansion.inspiration.faithEnabled || !item.faith);
  const saved = all.filter(item => expansion.inspiration.savedIds.includes(item.id));
  const categories = [...new Set(all.map(item => item.category).filter(Boolean))];

  return `
    <div class="v1-panel-tabs">
      <button class="${currentPanelSub === "overview" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="overview">For You</button>
      <button class="${currentPanelSub === "stories" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="stories">Stories</button>
      <button class="${currentPanelSub === "quotes" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="quotes">Quotes & Messages</button>
      <button class="${currentPanelSub === "saved" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="saved">Saved (${saved.length})</button>
    </div>
    ${currentPanelSub === "overview" ? `
      <section class="v1-panel-section">
        <span class="v1-kicker">Today's Inspiration</span>
        ${dailyInspirationCard(daily, { account: true })}
      </section>
      <section class="v1-panel-section">
        <div class="v1-panel-section-heading"><div><h3>What do you want encouragement around?</h3><p>Prototype personalization categories.</p></div></div>
        <div class="v1-chip-list">${categories.map(category => `<span>${escapeHtml(category)}</span>`).join("")}</div>
        <label class="v1-check-row inline"><input type="checkbox" id="v1FaithToggle" ${expansion.inspiration.faithEnabled ? "checked" : ""} /><span>Include optional Faith & Values inspiration</span></label>
      </section>
    ` : ""}
    ${currentPanelSub === "stories" ? `<section class="v1-story-grid compact">${SEED_STORIES.map(story => `<article class="v1-story-card"><span class="v1-kicker">${escapeHtml(story.eyebrow)}</span><h3>${escapeHtml(story.title)}</h3><p>${escapeHtml(story.summary)}</p><div class="v1-story-detail">${escapeHtml(story.body)}</div><small>${escapeHtml(story.status)}</small></article>`).join("")}</section>` : ""}
    ${currentPanelSub === "quotes" ? `<section class="v1-quote-grid">${all.map(item => dailyInspirationCard(item, { account: true })).join("")}</section>` : ""}
    ${currentPanelSub === "saved" ? (saved.length ? `<section class="v1-quote-grid">${saved.map(item => dailyInspirationCard(item, { account: true })).join("")}</section>` : `<div class="v1-empty-panel"><strong>No saved inspiration yet.</strong><p>Save a message or quote and it will appear here.</p></div>`) : ""}
  `;
}

function roleContextPreview(id) {
  const item = contextDefinition(id);
  return `
    <article class="v1-role-preview">
      <div class="v1-role-preview-head"><span>${item.icon}</span><div><small>${escapeHtml(item.kind === "entity" ? "Entity workspace" : "Personal role")}</small><h3>${escapeHtml(item.label)}</h3></div></div>
      <p>${escapeHtml(item.description)}</p>
      <div class="v1-permission-list">${item.permissions.map(permission => `<span>✓ ${escapeHtml(permission)}</span>`).join("")}</div>
    </article>
  `;
}

function renderAccountPanel() {
  const core = getCoreState() || {};
  const active = contextDefinition();
  const account = getLocalAccount();
  const enabled = new Set(expansion.enabledContexts);

  return `
    <div class="v1-panel-tabs">
      <button class="${currentPanelSub === "overview" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="overview">Overview</button>
      <button class="${currentPanelSub === "roles" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="roles">Roles & Accounts</button>
      <button class="${currentPanelSub === "family" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="family">Family</button>
      <button class="${currentPanelSub === "organizations" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="organizations">Teams & Organizations</button>
      <button class="${currentPanelSub === "memberships" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="memberships">Memberships</button>
      <button class="${currentPanelSub === "links" ? "active" : ""}" type="button" data-v1-action="panel-sub" data-panel-sub="links">Links & Socials</button>
    </div>

    ${currentPanelSub === "overview" ? `
      <div class="v1-account-hero">
        <div><span class="v1-kicker">Prototype identity</span><h3>${escapeHtml(account?.displayName || core.profile?.displayName || "Prototype User")}</h3><p>One identity can hold multiple roles. Role permissions stay scoped instead of silently merging.</p></div>
        <span class="v1-context-badge">${active.icon} ${escapeHtml(active.label)}</span>
      </div>
      ${roleContextPreview(active.id)}
      <div class="v1-mini-grid section-space">
        <article><strong>${expansion.enabledContexts.length}</strong><span>Enabled contexts</span></article>
        <article><strong>${expansion.familyLinks.length}</strong><span>Family links</span></article>
        <article><strong>${expansion.entities.length}</strong><span>Team/org workspaces</span></article>
        <article><strong>${expansion.socialLinks.filter(link => link.url).length}</strong><span>Profile links</span></article>
      </div>
    ` : ""}

    ${currentPanelSub === "roles" ? `
      <section class="v1-panel-section">
        <div class="v1-panel-section-heading"><div><h3>Account types & contexts</h3><p>Prototype every account type from one ecosystem without forcing duplicate passwords.</p></div></div>
        <div class="v1-role-grid">
          ${ACCOUNT_TYPES.map(item => `
            <article class="v1-role-card ${expansion.activeContext === item.id ? "active" : ""}">
              <div class="v1-role-card-head"><span>${item.icon}</span><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.kind)}</small></div></div>
              <p>${escapeHtml(item.description)}</p>
              <label class="v1-check-row inline"><input type="checkbox" data-v1-role-toggle="${escapeHtml(item.id)}" ${enabled.has(item.id) ? "checked" : ""} /><span>Enable this context</span></label>
              <button type="button" class="v1-button ${expansion.activeContext === item.id ? "soft" : "secondary"} full" data-v1-action="set-active-context" data-context-id="${escapeHtml(item.id)}" ${enabled.has(item.id) ? "" : "disabled"}>${expansion.activeContext === item.id ? "Active context" : "Switch to this context"}</button>
            </article>
          `).join("")}
        </div>
      </section>
    ` : ""}

    ${currentPanelSub === "family" ? `
      <section class="v1-panel-section">
        <div class="v1-panel-section-heading"><div><h3>Parent / Guardian & Family prototype</h3><p>Family relationships are explicit. Guardian payment or family membership does not automatically create broader access.</p></div></div>
        <div class="v1-list-cards">
          ${expansion.familyLinks.map(link => `<article><div><strong>${escapeHtml(link.athleteName)}</strong><span>${escapeHtml(link.relationship)} · ${escapeHtml(link.status)}</span></div><div><span>${escapeHtml(link.consent)}</span><small>${escapeHtml(link.visibility)}</small></div></article>`).join("")}
        </div>
        <form id="v1FamilyLinkForm" class="v1-form section-space">
          <div><label>Demo athlete name</label><input name="athleteName" maxlength="80" placeholder="Use fictional/demo information" required /></div>
          <div><label>Relationship</label><select name="relationship"><option>Parent / Guardian</option><option>Authorized Family Adult</option><option>Sibling</option><option>Other verified relationship</option></select></div>
          <button class="v1-button primary" type="submit">Add demo family link</button>
        </form>
        <div class="v1-notice">No email match alone should establish a real guardian relationship. Production would need verified authority, age handling, consent, revocation, and human review where authority is unclear.</div>
      </section>
    ` : ""}

    ${currentPanelSub === "organizations" ? `
      <section class="v1-panel-section">
        <div class="v1-panel-section-heading"><div><h3>Team & Organization workspaces</h3><p>Entity accounts sit beside personal identities. People receive scoped roles inside them.</p></div></div>
        <div class="v1-entity-grid">
          ${expansion.entities.map(entity => `<article><span class="v1-pill">${escapeHtml(entity.type)}</span><h3>${escapeHtml(entity.name)}</h3><p>${escapeHtml(entity.role)} · ${entity.members} demo members</p><small>${escapeHtml(entity.status)}</small></article>`).join("")}
        </div>
        <div class="v1-notice">A coach who is also a guardian keeps those permissions separate. Organization removal ends organization-scoped access without deleting the person's independent NextStage identity.</div>
      </section>
    ` : ""}

    ${currentPanelSub === "memberships" ? renderMembershipsPanel() : ""}
    ${currentPanelSub === "links" ? renderLinksPanel() : ""}
  `;
}

function renderMembershipsPanel() {
  return `
    <section class="v1-panel-section">
      <div class="v1-panel-section-heading"><div><h3>Player & Family memberships</h3><p>Membership benefits stay separate from identity, safety, guardian authority, and organization roster capacity.</p></div></div>
      <div class="v1-membership-grid">
        ${PLAYER_MEMBERSHIPS.map(plan => `<article class="${expansion.memberships.player === plan.name ? "selected" : ""}"><span class="v1-pill">Player</span><h3>${escapeHtml(plan.name)}</h3><strong>${escapeHtml(plan.price)}</strong><ul>${plan.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join("")}</ul><button type="button" class="v1-button secondary full" data-v1-action="select-player-plan" data-plan="${escapeHtml(plan.name)}">${expansion.memberships.player === plan.name ? "Selected" : "Preview plan"}</button></article>`).join("")}
      </div>
      <div class="v1-membership-grid section-space">
        ${FAMILY_MEMBERSHIPS.map(plan => `<article class="${expansion.memberships.family === plan.name ? "selected" : ""}"><span class="v1-pill">Family</span><h3>${escapeHtml(plan.name)}</h3><strong>${escapeHtml(plan.price)}</strong><ul>${plan.features.map(feature => `<li>${escapeHtml(feature)}</li>`).join("")}</ul><button type="button" class="v1-button secondary full" data-v1-action="select-family-plan" data-plan="${escapeHtml(plan.name)}">${expansion.memberships.family === plan.name ? "Selected" : "Preview plan"}</button></article>`).join("")}
      </div>
      <div class="v1-notice">Purchasing a higher tier must never automatically grant public visibility, direct-message access, coach access, roster placement, recruiting outcomes, or stronger safety protections.</div>
    </section>
  `;
}

function linkRows() {
  const limits = [
    ["Personal Website", 1], ["YouTube", 2], ["TikTok", 1], ["Facebook", 1], ["Threads", 1], ["Instagram", 1], ["X / Twitter", 1], ["LinkedIn", 1], ["Twitch", 1], ["Other", 3]
  ];
  const rows = [];

  limits.forEach(([platform, count]) => {
    for (let index = 0; index < count; index += 1) {
      const key = `${platform}-${index}`;
      const saved = expansion.socialLinks.find(link => link.key === key) || {};
      rows.push({ key, platform: count > 1 ? `${platform} ${index + 1}` : platform, basePlatform: platform, ...saved });
    }
  });

  return rows;
}

function renderLinksPanel() {
  return `
    <section class="v1-panel-section">
      <div class="v1-panel-section-heading"><div><h3>Athlete Links & Socials</h3><p>Use only links the athlete wants associated with the profile. V1 stores them locally.</p></div></div>
      <form id="v1SocialLinksForm" class="v1-social-editor">
        ${linkRows().map(row => `
          <div class="v1-social-editor-row">
            <div><strong>${escapeHtml(row.platform)}</strong><small>${escapeHtml(row.basePlatform === "Other" ? "Custom link" : "Recognized platform")}</small></div>
            <input name="url__${escapeHtml(row.key)}" type="url" value="${escapeHtml(row.url || "")}" placeholder="https://" />
            <select name="visibility__${escapeHtml(row.key)}"><option ${row.visibility === "Public" || !row.visibility ? "selected" : ""}>Public</option><option ${row.visibility === "Coaches & Organizations" ? "selected" : ""}>Coaches & Organizations</option><option ${row.visibility === "Private" ? "selected" : ""}>Private</option></select>
          </div>
        `).join("")}
        <button class="v1-button primary" type="submit">Save links</button>
      </form>
    </section>
  `;
}

function renderFeaturedCustomizer() {
  const core = getCoreState() || {};
  const categories = core.development?.categories || [];
  const experiences = core.experiences || [];
  const achievements = core.achievements || [];
  const highlights = core.highlights || [];

  return `
    <section class="v1-panel-section">
      <div class="v1-panel-section-heading"><div><h3>Customize Featured</h3><p>Select one small summary from each Passport area for Overview.</p></div></div>
      <form id="v1FeaturedForm" class="v1-form two-column">
        <div><label>Development</label><select name="developmentCategory">${categories.map(item => `<option value="${escapeHtml(item.name)}" ${expansion.featured.developmentCategory === item.name ? "selected" : ""}>${escapeHtml(item.name)} · ${item.score}%</option>`).join("")}</select></div>
        <div><label>Experience</label><select name="experienceId">${experiences.map(item => `<option value="${escapeHtml(item.id)}" ${expansion.featured.experienceId === item.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}</select></div>
        <div><label>Achievement</label><select name="achievementId">${achievements.map(item => `<option value="${escapeHtml(item.id)}" ${expansion.featured.achievementId === item.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}</select></div>
        <div><label>Highlight</label><select name="highlightId">${highlights.map(item => `<option value="${escapeHtml(item.id)}" ${expansion.featured.highlightId === item.id ? "selected" : ""}>${escapeHtml(item.title)}</option>`).join("")}</select></div>
        <div class="full"><label>Overview item featured in other tabs</label><select name="overviewChoice"><option value="about" ${expansion.featured.overviewChoice === "about" ? "selected" : ""}>About / Bio</option><option value="headline" ${expansion.featured.overviewChoice === "headline" ? "selected" : ""}>Headline</option><option value="availability" ${expansion.featured.overviewChoice === "availability" ? "selected" : ""}>Availability</option></select></div>
        <button class="v1-button primary" type="submit">Save Featured selections</button>
      </form>
    </section>
  `;
}

const ADMIN_TABS = [
  ["overview", "Overview", "⌂"],
  ["inspiration", "Inspiration CMS", "✦"],
  ["accounts", "Accounts & Roles", "◎"],
  ["organizations", "Teams & Organizations", "▦"],
  ["website", "Company Website", "↔"],
  ["safety", "Safety & Moderation", "!"],
  ["plans", "Plans & Capacity", "$"],
  ["diagnostics", "Diagnostics", "✓"]
];

function renderAdminNav() {
  const nav = $("#v1AdminNav");
  if (!nav) return;
  nav.innerHTML = ADMIN_TABS.map(([id, label, icon]) => `<button type="button" class="${currentAdminTab === id ? "active" : ""}" data-v1-admin-tab="${id}"><span>${icon}</span>${escapeHtml(label)}</button>`).join("");
}

function adminHeader(kicker, title, copy) {
  return `<div class="v1-admin-page-head"><span class="v1-kicker">${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(copy)}</p></div>`;
}

function renderAdminOverview() {
  const core = getCoreState() || {};
  const account = getLocalAccount();
  const published = getPublishedCustomInspiration().length;
  const openSafety = expansion.safetyQueue.filter(item => item.status === "Open").length;
  return `
    ${adminHeader("Operations dashboard", "Prototype backend", "A local-only demonstration of the internal tools NextStage would need to manage the public company website and individual/entity account ecosystem.")}
    <div class="v1-admin-stat-grid">
      <article><span>LOCAL ACCOUNT</span><strong>${account ? "1" : "0"}</strong><small>${account ? "Prototype identity present" : "No local account yet"}</small></article>
      <article><span>ENABLED CONTEXTS</span><strong>${expansion.enabledContexts.length}</strong><small>Across ${ACCOUNT_TYPES.length} modeled types</small></article>
      <article><span>CONTENT ITEMS</span><strong>${SEED_INSPIRATION.length + expansion.inspiration.customItems.length}</strong><small>${published} custom live/scheduled</small></article>
      <article><span>SAFETY QUEUE</span><strong>${openSafety}</strong><small>Fictional review items</small></article>
    </div>
    <div class="v1-admin-grid two">
      <article class="v1-admin-card"><span class="v1-kicker">Core athlete prototype</span><h3>Existing work remains intact</h3><p>${core ? "Current athlete state is available and the expansion layer reads it without replacing the original app code." : "The original core state will appear after the athlete app initializes."}</p><div class="v1-code-note">app.js · data.js · storage.js · auth.js · styles.css preserved</div></article>
      <article class="v1-admin-card"><span class="v1-kicker">Three V1 surfaces</span><h3>Company · Accounts · Backend</h3><p>The same PWA now demonstrates the public company presence, the signed-in account experience, and the internal operational side needed to manage both.</p></article>
    </div>
    <div class="v1-admin-grid three section-space">
      <button class="v1-admin-jump" data-v1-admin-tab="inspiration"><span>✦</span><strong>Schedule Daily Inspiration</strong><small>Write, curate, schedule, publish, archive.</small></button>
      <button class="v1-admin-jump" data-v1-admin-tab="safety"><span>!</span><strong>Review Safety Queue</strong><small>Moderation and youth-protection workflow concept.</small></button>
      <button class="v1-admin-jump" data-v1-admin-tab="diagnostics"><span>✓</span><strong>Run V1 Diagnostics</strong><small>Check important prototype surfaces and local state.</small></button>
    </div>
  `;
}

function renderAdminInspiration() {
  return `
    ${adminHeader("Content operations", "Daily Inspiration CMS", "Create or curate content, assign a source type, schedule a date, and decide whether an item is Draft, Scheduled, Published, or Archived.")}
    <div class="v1-admin-grid two">
      <article class="v1-admin-card">
        <h3>Create inspiration</h3>
        <form id="v1AdminInspirationForm" class="v1-form">
          <div><label>Title</label><input name="title" maxlength="100" required /></div>
          <div><label>Message / quote</label><textarea name="body" maxlength="500" required></textarea></div>
          <div class="v1-form-row"><div><label>Category</label><input name="category" maxlength="60" value="Motivation" required /></div><div><label>Source type</label><select name="sourceType"><option>NextStage Original</option><option>Founder Note</option><option>Found Quote</option><option>Scripture Theme</option><option>Community Story</option></select></div></div>
          <div class="v1-form-row"><div><label>Attribution / source</label><input name="attribution" maxlength="120" value="NextStage Athletics" required /></div><div><label>Publish date</label><input name="publishDate" type="date" value="${isoToday()}" required /></div></div>
          <div class="v1-form-row"><div><label>Status</label><select name="status"><option>Draft</option><option selected>Scheduled</option><option>Published</option><option>Archived</option></select></div><label class="v1-check-row inline"><input name="faith" type="checkbox" /><span>Faith & Values content</span></label></div>
          <button class="v1-button primary" type="submit">Save content item</button>
        </form>
        <div class="v1-notice">For found quotations or identifiable community stories, the production workflow should record the real source, permissions where needed, and editorial/safety review. V1 does not scrape or publish new internet content automatically.</div>
      </article>
      <article class="v1-admin-card">
        <h3>Today's public item</h3>
        ${dailyInspirationCard(getDailyInspiration({ publicView: true }))}
      </article>
    </div>
    <article class="v1-admin-card section-space">
      <div class="v1-admin-card-head"><div><h3>Content library</h3><p>Seed originals plus anything created in this local backend prototype.</p></div><span class="v1-demo-chip">${SEED_INSPIRATION.length + expansion.inspiration.customItems.length} items</span></div>
      <div class="v1-admin-content-list">
        ${expansion.inspiration.customItems.length ? expansion.inspiration.customItems.map(item => `<div><div><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.category)} · ${escapeHtml(item.sourceType)} · ${formatDate(item.publishDate)}</span></div><div><span class="v1-status ${String(item.status).toLowerCase()}">${escapeHtml(item.status)}</span><button type="button" data-v1-action="cycle-content-status" data-content-id="${escapeHtml(item.id)}">Change status</button></div></div>`).join("") : `<div class="v1-empty-mini">No custom items yet. The daily system currently rotates through ${SEED_INSPIRATION.length} built-in NextStage originals.</div>`}
      </div>
    </article>
  `;
}

function renderAdminAccounts() {
  return `
    ${adminHeader("Identity & authorization", "Accounts & Roles", "Model one identity with multiple contexts while keeping access scoped to the relationship that granted it.")}
    <div class="v1-admin-grid three">
      ${ACCOUNT_TYPES.map(item => `<article class="v1-admin-card"><div class="v1-role-card-head"><span>${item.icon}</span><div><h3>${escapeHtml(item.label)}</h3><small>${escapeHtml(item.kind)}</small></div></div><p>${escapeHtml(item.description)}</p><div class="v1-permission-list">${item.permissions.slice(0,3).map(permission => `<span>✓ ${escapeHtml(permission)}</span>`).join("")}</div></article>`).join("")}
    </div>
  `;
}

function renderAdminOrganizations() {
  const plan = ORGANIZATION_PLANS.find(item => item.name === expansion.memberships.organization) || ORGANIZATION_PLANS[4];
  return `
    ${adminHeader("Entity operations", "Teams & Organizations", "Prototype entity accounts, memberships, team allocation, and organization-wide capacity controls.")}
    <div class="v1-admin-grid two">
      ${expansion.entities.map(entity => `<article class="v1-admin-card"><span class="v1-pill">${escapeHtml(entity.type)}</span><h3>${escapeHtml(entity.name)}</h3><p>${escapeHtml(entity.role)}</p><strong>${entity.members} demo members</strong><small>${escapeHtml(entity.status)}</small></article>`).join("")}
    </div>
    <article class="v1-admin-card section-space">
      <div class="v1-admin-card-head"><div><h3>Current organization capacity preview</h3><p>Organization-wide ceilings. Team allocations are shares of these limits, not extra capacity.</p></div><strong>${escapeHtml(plan.name)}</strong></div>
      <div class="v1-capacity-grid">${["teams","players","coaches","staff","parents","spectators"].map(key => `<div><span>${key}</span><strong>${escapeHtml(plan[key])}</strong></div>`).join("")}</div>
    </article>
  `;
}

function renderAdminWebsite() {
  const labels = {
    home: "Home", about: "About", athletes: "Athletes", families: "Families", organizations: "Organizations", coaches: "Coaches & Trainers", inspiration: "Stories & Inspiration", partnerships: "Partnerships", sponsorships: "Sponsorships", careers: "Careers", contact: "Contact", safety: "Safety & Privacy"
  };
  return `
    ${adminHeader("Company content", "Company Website", "Manage which public-facing company pages are represented in Prototype V1 and jump directly to the published preview.")}
    <article class="v1-admin-card">
      <div class="v1-website-admin-list">
        ${Object.entries(expansion.website.pageStatuses).map(([id,status]) => `<div><div><strong>${escapeHtml(labels[id] || id)}</strong><span>Public company website</span></div><div><span class="v1-status published">${escapeHtml(status)}</span><button type="button" data-v1-action="preview-company-page" data-company-page="${escapeHtml(id)}">Preview</button></div></div>`).join("")}
      </div>
    </article>
  `;
}

function renderAdminSafety() {
  return `
    ${adminHeader("Trust & safety", "Safety & Moderation", "A human-review concept for youth privacy, content reports, permissions, and other issues that should not be resolved by silently widening access.")}
    <div class="v1-admin-grid two">
      ${expansion.safetyQueue.map(item => `<article class="v1-admin-card"><div class="v1-admin-card-head"><span class="v1-pill">${escapeHtml(item.priority)}</span><span class="v1-status ${item.status.toLowerCase()}">${escapeHtml(item.status)}</span></div><h3>${escapeHtml(item.subject)}</h3><p>${escapeHtml(item.note)}</p><small>${escapeHtml(item.type)}</small><button type="button" class="v1-button secondary" data-v1-action="toggle-safety-status" data-safety-id="${escapeHtml(item.id)}">${item.status === "Open" ? "Mark reviewed" : "Reopen"}</button></article>`).join("")}
    </div>
    <div class="v1-notice strong">Prototype V1 demonstrates a queue, not production moderation. Real launch would require reporting standards, escalation, incident response, retention, trained reviewers, law-enforcement/emergency procedures where applicable, and jurisdiction-specific review.</div>
  `;
}

function renderAdminPlans() {
  return `
    ${adminHeader("Commercial concept", "Plans & Capacity", "Preview player/family memberships and the ten organization presets plus configurable Max. No real billing occurs.")}
    <article class="v1-admin-card">
      <div class="v1-table-wrap"><table class="v1-plan-table"><thead><tr><th>Plan</th><th>Teams</th><th>Players</th><th>Coaches</th><th>Staff</th><th>Parents/Guardians</th><th>Spectators</th></tr></thead><tbody>${ORGANIZATION_PLANS.map(plan => `<tr class="${expansion.memberships.organization === plan.name ? "selected" : ""}"><td><button type="button" data-v1-action="select-org-plan" data-plan="${escapeHtml(plan.name)}">${escapeHtml(plan.name)}</button></td><td>${escapeHtml(plan.teams)}</td><td>${escapeHtml(plan.players)}</td><td>${escapeHtml(plan.coaches)}</td><td>${escapeHtml(plan.staff)}</td><td>${escapeHtml(plan.parents)}</td><td>${escapeHtml(plan.spectators)}</td></tr>`).join("")}</tbody></table></div>
      <div class="v1-notice">These values are prototype capacity examples, not finalized prices, entitlements, contracts, or billing policy.</div>
    </article>
  `;
}

function diagnosticChecks() {
  const core = getCoreState();
  const tests = [
    ["Original app shell exists", Boolean($(".app-shell"))],
    ["Original Athlete Passport view exists", Boolean($("#view-profile"))],
    ["Original storage state readable", Boolean(core)],
    ["Local prototype auth available", Boolean($("#authScreen"))],
    ["Public company shell mounted", Boolean($("#v1CompanyShell"))],
    ["Backend/admin shell mounted", Boolean($("#v1AdminShell"))],
    ["Privacy gate mounted", Boolean($("#v1PrivacyGate"))],
    ["Expansion local storage writable", (() => { try { saveExpansionState(); return true; } catch { return false; } })()],
    ["Manifest linked", Boolean(document.querySelector('link[rel="manifest"]'))],
    ["Service workers supported by browser", "serviceWorker" in navigator]
  ];
  return tests;
}

function renderAdminDiagnostics() {
  const checks = diagnosticChecks();
  const passed = checks.filter(([,result]) => result).length;
  return `
    ${adminHeader("V1 quality check", "Prototype Diagnostics", "A browser-side sanity check for the preserved athlete app and the new company/account/admin expansion layer.")}
    <article class="v1-admin-card">
      <div class="v1-diagnostic-score"><strong>${passed}/${checks.length}</strong><span>checks passing in this browser</span></div>
      <div class="v1-diagnostic-list">${checks.map(([label,result]) => `<div class="${result ? "pass" : "fail"}"><span>${result ? "✓" : "!"}</span><strong>${escapeHtml(label)}</strong><small>${result ? "PASS" : "CHECK"}</small></div>`).join("")}</div>
      <div class="v1-actions"><button type="button" class="v1-button primary" data-v1-action="rerun-diagnostics">Run again</button><button type="button" class="v1-button secondary" data-v1-action="open-app">Test account app</button><button type="button" class="v1-button secondary" data-v1-action="open-company">Test company site</button></div>
    </article>
    <div class="v1-notice strong">After every GitHub update, use Command + Shift + R on Mac Chrome to hard refresh the deployed prototype. The PWA/service-worker cache can otherwise make an older build look current.</div>
  `;
}

function renderAdmin(tab = currentAdminTab) {
  currentAdminTab = tab;
  renderAdminNav();
  const main = $("#v1AdminMain");
  if (!main) return;

  const renderers = {
    overview: renderAdminOverview,
    inspiration: renderAdminInspiration,
    accounts: renderAdminAccounts,
    organizations: renderAdminOrganizations,
    website: renderAdminWebsite,
    safety: renderAdminSafety,
    plans: renderAdminPlans,
    diagnostics: renderAdminDiagnostics
  };

  main.innerHTML = (renderers[tab] || renderAdminOverview)();
  renderAdminNav();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function refreshCurrentPanel() {
  if (!currentPanel) return;
  const body = $("#v1PanelBody");
  if (!body) return;
  body.innerHTML = currentPanel === "inspiration"
    ? renderInspirationPanel()
    : currentPanel === "account"
      ? renderAccountPanel()
      : renderHubPanel();
}

function handleExpansionAction(target) {
  const action = target.dataset.v1Action;
  if (!action) return;

  switch (action) {
    case "open-company":
      closePanel();
      showCompany("home");
      break;
    case "open-app":
      closePanel();
      showApp();
      break;
    case "open-admin":
      closePanel();
      showAdmin("overview");
      break;
    case "accept-terms": {
      const terms = $("#v1TermsCheck");
      const safety = $("#v1SafetyCheck");
      if (!terms?.checked || !safety?.checked) {
        terms?.closest(".v1-privacy-card")?.classList.add("v1-needs-attention");
        return;
      }
      expansion.terms.acceptedVersion = TERMS_VERSION;
      expansion.terms.acceptedAt = new Date().toISOString();
      saveExpansionState();
      if (pendingMode === "admin") showAdmin("overview");
      else enterAppAfterGate();
      break;
    }
    case "auth-learn":
      showAuthLearnMore();
      break;
    case "open-inspiration":
      currentPanelSub = "overview";
      openPanel("inspiration", "overview");
      break;
    case "open-account":
      currentPanelSub = "overview";
      openPanel("account", "overview");
      break;
    case "open-hub":
      openPanel("hub", "overview");
      break;
    case "close-panel":
      closePanel();
      break;
    case "panel-sub":
      currentPanelSub = target.dataset.panelSub || "overview";
      refreshCurrentPanel();
      break;
    case "toggle-inspiration-save": {
      const id = target.dataset.inspirationId;
      if (!id) break;
      expansion.inspiration.savedIds = expansion.inspiration.savedIds.includes(id)
        ? expansion.inspiration.savedIds.filter(item => item !== id)
        : [...expansion.inspiration.savedIds, id];
      saveExpansionState();
      refreshCurrentPanel();
      $("#v1DailyDashboard")?.remove();
      injectDashboardInspiration();
      break;
    }
    case "customize-featured":
      currentPanel = "account";
      currentPanelSub = "featured";
      $("#v1PanelTitle").textContent = "Customize Featured";
      $("#v1PanelBody").innerHTML = renderFeaturedCustomizer();
      $("#v1PanelBackdrop").hidden = false;
      break;
    case "edit-social-links":
      currentPanel = "account";
      currentPanelSub = "links";
      $("#v1PanelTitle").textContent = "Links & Socials";
      $("#v1PanelBody").innerHTML = renderLinksPanel();
      $("#v1PanelBackdrop").hidden = false;
      break;
    case "set-active-context": {
      const id = target.dataset.contextId;
      if (!expansion.enabledContexts.includes(id)) break;
      expansion.activeContext = id;
      saveExpansionState();
      refreshCurrentPanel();
      break;
    }
    case "select-player-plan":
      expansion.memberships.player = target.dataset.plan;
      saveExpansionState();
      refreshCurrentPanel();
      break;
    case "select-family-plan":
      expansion.memberships.family = target.dataset.plan;
      saveExpansionState();
      refreshCurrentPanel();
      break;
    case "select-org-plan":
      expansion.memberships.organization = target.dataset.plan;
      saveExpansionState();
      renderAdmin("plans");
      break;
    case "cycle-content-status": {
      const item = expansion.inspiration.customItems.find(entry => entry.id === target.dataset.contentId);
      if (!item) break;
      const statuses = ["Draft", "Scheduled", "Published", "Archived"];
      item.status = statuses[(statuses.indexOf(item.status) + 1) % statuses.length];
      saveExpansionState();
      renderAdmin("inspiration");
      break;
    }
    case "toggle-safety-status": {
      const item = expansion.safetyQueue.find(entry => entry.id === target.dataset.safetyId);
      if (!item) break;
      item.status = item.status === "Open" ? "Reviewed" : "Open";
      saveExpansionState();
      renderAdmin("safety");
      break;
    }
    case "preview-company-page":
      showCompany(target.dataset.companyPage || "home");
      break;
    case "rerun-diagnostics":
      renderAdmin("diagnostics");
      break;
  }
}

function bindExpansionEvents() {
  document.addEventListener("click", event => {
    const authView = event.target.closest("[data-auth-view]");
    if (authView) {
      const learnPanel = $("#v1AuthLearnPanel");
      const learnTab = $("#v1AuthLearnTab");
      if (learnPanel) learnPanel.hidden = true;
      learnTab?.classList.remove("active");
    }

    const companyPage = event.target.closest("[data-v1-company-page]");
    if (companyPage) {
      renderCompany(companyPage.dataset.v1CompanyPage || "home");
      return;
    }

    const adminTab = event.target.closest("[data-v1-admin-tab]");
    if (adminTab) {
      renderAdmin(adminTab.dataset.v1AdminTab || "overview");
      return;
    }

    const action = event.target.closest("[data-v1-action]");
    if (action) {
      event.preventDefault();
      handleExpansionAction(action);
      return;
    }

    if (event.target.closest("[data-profile-tab]")) {
      window.setTimeout(updateViewAllFeatureVisibility, 20);
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "v1FaithToggle") {
      expansion.inspiration.faithEnabled = event.target.checked;
      saveExpansionState();
      refreshCurrentPanel();
      return;
    }

    if (event.target.id === "v1EntryPreference") {
      expansion.entryPreference = event.target.value;
      saveExpansionState();
      return;
    }

    const roleId = event.target.dataset.v1RoleToggle;
    if (roleId) {
      if (event.target.checked) {
        if (!expansion.enabledContexts.includes(roleId)) expansion.enabledContexts.push(roleId);
      } else {
        expansion.enabledContexts = expansion.enabledContexts.filter(id => id !== roleId);
        if (!expansion.enabledContexts.length) expansion.enabledContexts = ["athlete"];
        if (!expansion.enabledContexts.includes(expansion.activeContext)) expansion.activeContext = expansion.enabledContexts[0];
      }
      saveExpansionState();
      refreshCurrentPanel();
    }
  });

  document.addEventListener("submit", event => {
    if (event.target.id === "v1FeaturedForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      expansion.featured.developmentCategory = String(form.get("developmentCategory") || "");
      expansion.featured.experienceId = String(form.get("experienceId") || "");
      expansion.featured.achievementId = String(form.get("achievementId") || "");
      expansion.featured.highlightId = String(form.get("highlightId") || "");
      expansion.featured.overviewChoice = String(form.get("overviewChoice") || "about");
      saveExpansionState();
      closePanel();
      $("#v1FeaturedOverview")?.remove();
      $$(".v1-cross-feature").forEach(item => item.remove());
      injectProfileEnhancements();
      return;
    }

    if (event.target.id === "v1SocialLinksForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      const links = [];
      linkRows().forEach(row => {
        const url = String(form.get(`url__${row.key}`) || "").trim();
        const visibility = String(form.get(`visibility__${row.key}`) || "Public");
        if (!url) return;
        if (!/^https?:\/\//i.test(url)) return;
        links.push({ key: row.key, platform: row.platform, basePlatform: row.basePlatform, url, visibility });
      });
      expansion.socialLinks = links;
      saveExpansionState();
      refreshCurrentPanel();
      $("#v1SocialLinksCard")?.remove();
      injectProfileEnhancements();
      return;
    }

    if (event.target.id === "v1FamilyLinkForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      expansion.familyLinks.push({
        id: `family-${Date.now()}`,
        athleteName: String(form.get("athleteName") || "Demo Athlete"),
        relationship: String(form.get("relationship") || "Parent / Guardian"),
        status: "Pending prototype link",
        consent: "Consent not yet demonstrated",
        visibility: "No athlete data revealed before acceptance"
      });
      saveExpansionState();
      refreshCurrentPanel();
      return;
    }

    if (event.target.id === "v1AdminInspirationForm") {
      event.preventDefault();
      const form = new FormData(event.target);
      expansion.inspiration.customItems.unshift({
        id: `custom-${Date.now()}`,
        title: String(form.get("title") || ""),
        body: String(form.get("body") || ""),
        category: String(form.get("category") || "Motivation"),
        sourceType: String(form.get("sourceType") || "NextStage Original"),
        attribution: String(form.get("attribution") || "NextStage Athletics"),
        publishDate: String(form.get("publishDate") || isoToday()),
        status: String(form.get("status") || "Draft"),
        faith: form.get("faith") === "on",
        createdAt: new Date().toISOString()
      });
      saveExpansionState();
      renderAdmin("inspiration");
    }
  });
}

function observeOriginalApp() {
  const auth = $("#authScreen");
  if (auth) {
    new MutationObserver(() => {
      if (currentMode === "app" && !auth.hidden) {
        window.setTimeout(activateAuthSignIn, 0);
      }
    }).observe(auth, { attributes: true, attributeFilter: ["hidden"] });
  }

  const profile = $("#view-profile");
  const dashboard = $("#view-dashboard");
  const settings = $("#view-settings");

  if (profile) {
    new MutationObserver(() => window.setTimeout(injectProfileEnhancements, 20)).observe(profile, { childList: true, subtree: false });
  }
  if (dashboard) {
    new MutationObserver(() => window.setTimeout(injectDashboardInspiration, 20)).observe(dashboard, { childList: true, subtree: false });
  }
  if (settings) {
    new MutationObserver(() => window.setTimeout(injectSettingsExpansion, 20)).observe(settings, { childList: true, subtree: false });
  }
}

function initializeFeaturedDefaults() {
  const core = getCoreState();
  if (!core) return;
  if (!expansion.featured.developmentCategory) expansion.featured.developmentCategory = core.development?.categories?.[0]?.name || "";
  if (!expansion.featured.experienceId) expansion.featured.experienceId = core.experiences?.[0]?.id || "";
  if (!expansion.featured.achievementId) expansion.featured.achievementId = core.achievements?.[0]?.id || "";
  if (!expansion.featured.highlightId) expansion.featured.highlightId = core.highlights?.[0]?.id || "";
  saveExpansionState();
}

function chooseInitialMode() {
  if (expansion.entryPreference === "company") return "company";
  if (expansion.entryPreference === "app") return "app";
  return getLocalAccount() ? "app" : "company";
}

function initializeExpansion() {
  mountExpansionRoot();
  injectAppControls();
  bindExpansionEvents();
  observeOriginalApp();
  initializeFeaturedDefaults();

  const mode = chooseInitialMode();
  if (mode === "app") showApp();
  else showCompany("home");

  scheduleAppEnhancements();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => window.setTimeout(initializeExpansion, 0), { once: true });
} else {
  window.setTimeout(initializeExpansion, 0);
}
}
