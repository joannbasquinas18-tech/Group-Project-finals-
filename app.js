let state = { members: [], plans: [], error: "", loading: true };
let activePage = "dashboard";
let memberQuery = "";
let toastTimer;

const pageContent = document.querySelector("#pageContent");
const modalLayer = document.querySelector("#modalLayer");
const todayLabel = document.querySelector("#todayLabel");
const globalSearch = document.querySelector("#globalSearch");

async function apiRequest(resource, { method = "GET", id, body } = {}) {
  try {
    const query = new URLSearchParams({ resource });
    if (id !== undefined) query.set("id", String(id));
    const response = await fetch(`api/index.php?${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    return result;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Can't reach the database API. Start Apache and MySQL, import database.sql, and open the app through http://localhost.");
    }
    throw error;
  }
}

async function loadData() {
  state.loading = true;
  state.error = "";
  renderPage();
  try {
    const [membersResult, plansResult] = await Promise.all([
      apiRequest("members"),
      apiRequest("plans")
    ]);
    state.members = membersResult.members;
    state.plans = plansResult.plans;
    state.loading = false;
    state.error = "";
    renderPage();
    return true;
  } catch (error) {
    console.error("Could not load gym data from the database.", error);
    state.loading = false;
    state.error = error.message;
    renderPage();
    return false;
  }
}

function todayKey() {
  const date = new Date();
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function todayAttendance() {
  return state.members.filter((member) => member.status !== "Inactive" && isCheckedIn(member));
}

function isCheckedIn(member) {
  return Boolean(member.checkedIn);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateString : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

function setPage(page) {
  activePage = page;
  const titles = { dashboard: "Dashboard", members: "Members", attendance: "Attendance", plans: "Membership plans" };
  document.querySelector("#pageBreadcrumb").textContent = titles[page];
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.page === page));
  document.querySelector("#sidebar").classList.remove("open");
  renderPage();
}

function heading(kicker, title, description, action = "") {
  return `<div class="page-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function memberRows(members, includeActions = false, attendance = false) {
  if (!members.length) return `<tr><td colspan="${includeActions ? 6 : 5}"><div class="empty-state"><strong>No members found</strong>Try a different search, or add your first member.</div></td></tr>`;
  return members.map((member) => {
    const statusClass = member.status.toLowerCase();
    return `<tr>
      <td><div class="member-cell"><span class="avatar" style="background:${escapeHtml(member.color || "#e7eadf")}">${escapeHtml(initials(member.name))}</span>${escapeHtml(member.name)}</div></td>
      <td class="table-email">${escapeHtml(member.email)}</td>
      <td>${escapeHtml(member.plan)}</td>
      <td>${formatDate(member.joined)}</td>
      <td><span class="status-pill ${statusClass}">${escapeHtml(member.status)}</span></td>
      ${includeActions ? `<td class="action-cell">${attendance ? `<button class="row-action" data-member-action="check-out" data-member-id="${escapeHtml(member.id)}" aria-label="Check out ${escapeHtml(member.name)}">✓</button>` : `<button class="row-action" data-member-action="edit" data-member-id="${escapeHtml(member.id)}" aria-label="Edit ${escapeHtml(member.name)}">✎</button><button class="row-action" data-member-action="${isCheckedIn(member) ? "check-out" : "check-in"}" data-member-id="${escapeHtml(member.id)}" aria-label="${isCheckedIn(member) ? "Check out" : "Check in"} ${escapeHtml(member.name)}">${isCheckedIn(member) ? "✓" : "＋"}</button><button class="row-action delete-action" data-member-action="delete" data-member-id="${escapeHtml(member.id)}" aria-label="Remove ${escapeHtml(member.name)}">×</button>`}</td>` : ""}
    </tr>`;
  }).join("");
}

function memberTable(members, options = {}) {
  const { attendance = false, footer = true } = options;
  return `<div class="panel table-panel">
    <div class="panel-heading"><div><h2>${attendance ? "Today's check-ins" : "Recent members"}</h2><p>${attendance ? "Live overview of today's gym visits" : "Keep an eye on your community"}</p></div>${attendance ? "" : `<button class="text-button" data-page-link="members">View all members ↗</button>`}</div>
    <div class="table-wrap"><table><thead><tr><th>MEMBER</th><th>EMAIL</th><th>PLAN</th><th>JOINED</th><th>STATUS</th>${attendance ? "<th>CHECK-IN</th>" : ""}</tr></thead><tbody>${memberRows(members, attendance, attendance)}</tbody></table></div>
    ${footer ? `<div class="table-footer"><span>Showing ${members.length} ${members.length === 1 ? "member" : "members"}</span><button class="text-button" data-page-link="${attendance ? "members" : "members"}">${attendance ? "Manage members" : "All members"} →</button></div>` : ""}
  </div>`;
}

function chartMarkup() {
  const points = [27, 38, 34, 57, 48, 69, 61, 76, 63, 84, 72, 93];
  const previous = [23, 31, 29, 47, 42, 58, 52, 65, 57, 71, 66, 78];
  const line = (values) => values.map((value, index) => `${index * 1100 / (values.length - 1)},${100 - value}`).join(" ");
  return `<div class="chart-area">
    <div class="chart-y-labels"><span>120</span><span>90</span><span>60</span><span>30</span><span>0</span></div>
    <div class="chart-gridlines"><span></span><span></span><span></span><span></span><span></span></div>
    <div class="chart-plot"><svg viewBox="0 0 1100 100" preserveAspectRatio="none" role="img" aria-label="Weekly member attendance trending upward"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#b3da7e" stop-opacity=".27"/><stop offset="1" stop-color="#b3da7e" stop-opacity="0"/></linearGradient></defs><polygon points="0,100 ${line(points)} 1100,100" fill="url(#chartFill)" /><polyline points="${line(previous)}" fill="none" stroke="#d7e3cc" stroke-width="2" stroke-dasharray="5 5" vector-effect="non-scaling-stroke" /><polyline points="${line(points)}" fill="none" stroke="#94c85c" stroke-width="2.5" vector-effect="non-scaling-stroke" />${points.map((value, index) => `<circle cx="${index * 100 / (points.length - 1)}%" cy="${100 - value}%" r="3" fill="#fff" stroke="#87b94f" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join("")}</svg></div>
    <div class="chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
  </div>`;
}

function renderDashboard() {
  const active = state.members.filter((member) => member.status !== "Inactive").length;
  const checkedIn = todayAttendance().length;
  const recent = [...state.members].sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 5);
  const weekday = new Intl.DateTimeFormat("en", { weekday: "long" }).format(new Date()).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${heading(`${weekday}, LET'S GET AFTER IT`, `${greeting}, Admin`, "Here's what's happening at your gym today.", `<button class="primary-button" data-action="add-member"><span class="plus">＋</span> Add a member</button>`)}
    <div class="stat-grid">
      <article class="stat-card"><div class="stat-top"><span>Total members</span><span class="stat-icon">♙</span></div><div class="stat-value">${state.members.length}</div><div class="stat-foot"><span class="trend">↗ 8.2%</span> vs. last month</div></article>
      <article class="stat-card"><div class="stat-top"><span>Active memberships</span><span class="stat-icon">◇</span></div><div class="stat-value">${active}</div><div class="stat-foot"><span class="trend">↗ 4.6%</span> vs. last month</div></article>
      <article class="stat-card"><div class="stat-top"><span>Checked in today</span><span class="stat-icon">◷</span></div><div class="stat-value">${checkedIn}</div><div class="stat-foot"><span class="trend">↗ 12.5%</span> vs. last Monday</div></article>
      <article class="stat-card"><div class="stat-top"><span>Memberships expiring</span><span class="stat-icon">⌁</span></div><div class="stat-value">${state.members.filter((member) => member.status === "Expiring").length}</div><div class="stat-foot">In the next 7 days</div></article>
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-heading"><div><h2>Attendance overview</h2><p>Member visits throughout the week</p></div><select class="select-control" aria-label="Attendance period"><option>This week</option><option>This month</option></select></div>${chartMarkup()}<div class="chart-legend"><span><i class="legend-dot"></i>This week</span><span><i class="legend-dot previous"></i>Last week</span></div></section>
      <section class="panel"><div class="panel-heading"><div><h2>Upcoming classes</h2><p>Today's schedule · ${formatDate(todayKey())}</p></div><button class="text-button" data-page-link="attendance">See all →</button></div>
        <div class="class-list">
          <div class="class-row"><span class="class-time">09:00 AM</span><div class="class-details"><strong>Morning Flow</strong><small>Yoga · with Maya Chen</small></div><span class="class-seats"><b>8</b> / 12 spots</span></div>
          <div class="class-row"><span class="class-time">11:30 AM</span><div class="class-details"><strong>Strength &amp; Conditioning</strong><small>Strength · with Alex Morgan</small></div><span class="class-seats"><b>10</b> / 14 spots</span></div>
          <div class="class-row"><span class="class-time">05:00 PM</span><div class="class-details"><strong>HIIT Express</strong><small>HIIT · with Sam Rivera</small></div><span class="class-seats"><b>6</b> / 10 spots</span></div>
          <div class="class-row"><span class="class-time">06:30 PM</span><div class="class-details"><strong>Evening Spin</strong><small>Spin · with Jamie Lee</small></div><span class="class-seats"><b>11</b> / 16 spots</span></div>
        </div>
      </section>
    </div>
    ${memberTable(recent)}`;
}

function getFilteredMembers() {
  const query = memberQuery.trim().toLowerCase();
  return [...state.members].filter((member) => [member.name, member.email, member.plan, member.status].some((value) => value.toLowerCase().includes(query)));
}

function renderMembers() {
  return `${heading("YOUR COMMUNITY", "Members", "Manage memberships and keep your member directory up to date.", `<button class="primary-button" data-action="add-member"><span class="plus">＋</span> Add a member</button>`)}
    <div class="panel table-panel"><div class="panel-heading"><div><h2>All members <span class="nav-count">${state.members.length}</span></h2><p>Every member in your gym</p></div><div class="member-toolbar"><input id="memberSearch" type="search" value="${escapeHtml(memberQuery)}" placeholder="Search members..." aria-label="Search members" /><select id="statusFilter" class="select-control" aria-label="Filter by status"><option value="">All statuses</option><option>Active</option><option>Expiring</option><option>Inactive</option></select></div></div>
    <div class="table-wrap"><table><thead><tr><th>MEMBER</th><th>EMAIL</th><th>PLAN</th><th>JOINED</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody id="membersRows">${memberRows(getFilteredMembers(), true)}</tbody></table></div>
    <div class="table-footer"><span id="memberCountLabel">Showing ${getFilteredMembers().length} of ${state.members.length} members</span><span>Member data is saved on this device</span></div></div>`;
}

function renderAttendance() {
  const visits = todayAttendance();
  return `${heading("DAILY ACTIVITY", "Attendance", "Track who's in the gym and manage today's check-ins.", `<button class="secondary-button" data-action="check-in-next">＋ Check in a member</button>`)}
    <div class="attendance-banner"><div><h2>Today's gym activity</h2><p>${formatDate(todayKey())} · Active members only</p></div><div><strong>${visits.length}</strong><small>members checked in</small></div></div>
    ${memberTable(visits, { attendance: true })}`;
}

function renderPlans() {
  const featuredPlan = state.plans.find((plan) => plan.name === "Standard");
  return `${heading("MEMBERSHIP OPTIONS", "Membership plans", "Simple options to help every member find their fit.", "")}
    <div class="plans-grid">${state.plans.map((plan) => `<article class="plan-card ${plan === featuredPlan ? "featured" : ""}">${plan === featuredPlan ? `<span class="popular-tag">Most popular</span>` : ""}<h2>${escapeHtml(plan.name)}</h2><p>${escapeHtml(plan.description)}</p><div class="plan-price">${new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(Number(plan.price))}<small> / month</small></div><div class="plan-divider"></div><ul class="plan-features">${plan.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul></article>`).join("")}</div>`;
}

function renderPage() {
  document.querySelector("#memberNavCount").textContent = state.members.length;
  if (state.loading) {
    pageContent.innerHTML = `<div class="empty-state"><strong>Loading gym data…</strong>Connecting to the database.</div>`;
    return;
  }
  if (state.error) {
    pageContent.innerHTML = `${heading("DATABASE CONNECTION", "Unable to load gym data", escapeHtml(state.error), `<button class="primary-button" data-action="retry">Try again</button>`)}`;
    return;
  }
  const renderers = { dashboard: renderDashboard, members: renderMembers, attendance: renderAttendance, plans: renderPlans };
  pageContent.innerHTML = renderers[activePage]();
}

function openMemberModal(member = null) {
  const editing = Boolean(member);
  modalLayer.innerHTML = `<form class="modal" id="memberForm"><div class="modal-header"><div><h2>${editing ? "Edit member" : "Add a new member"}</h2><p>${editing ? "Update this member's profile." : "Add someone new to your gym community."}</p></div><button class="modal-close" type="button" aria-label="Close dialog">×</button></div>
    <div class="form-grid">
      <div class="form-field full"><label for="memberName">Full name</label><input id="memberName" name="name" required maxlength="80" placeholder="e.g. Taylor Morgan" value="${escapeHtml(member?.name || "")}" /></div>
      <div class="form-field"><label for="memberEmail">Email address</label><input id="memberEmail" name="email" type="email" required maxlength="120" placeholder="name@example.com" value="${escapeHtml(member?.email || "")}" /></div>
      <div class="form-field"><label for="memberPhone">Phone number</label><input id="memberPhone" name="phone" type="tel" maxlength="30" placeholder="+63 917 123 4567" value="${escapeHtml(member?.phone || "")}" /></div>
      <div class="form-field"><label for="memberPlan">Membership plan</label><select id="memberPlan" name="plan" required>${state.plans.map((plan) => `<option ${member?.plan === plan.name ? "selected" : ""}>${escapeHtml(plan.name)}</option>`).join("")}</select></div>
      <div class="form-field"><label for="memberStatus">Status</label><select id="memberStatus" name="status"><option ${member?.status === "Active" || !member ? "selected" : ""}>Active</option><option ${member?.status === "Expiring" ? "selected" : ""}>Expiring</option><option ${member?.status === "Inactive" ? "selected" : ""}>Inactive</option></select></div>
    </div><div class="modal-actions"><button class="secondary-button modal-close" type="button">Cancel</button><button class="primary-button" type="submit">${editing ? "Save changes" : "Add member"}</button></div></form>`;
  modalLayer.hidden = false;
  modalLayer.querySelector("#memberName").focus();
  modalLayer.querySelectorAll(".modal-close").forEach((button) => button.addEventListener("click", closeModal));
  modalLayer.addEventListener("click", (event) => { if (event.target === modalLayer) closeModal(); }, { once: true });
  modalLayer.querySelector("#memberForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
      await apiRequest("members", { method: editing ? "PUT" : "POST", id: editing ? member.id : undefined, body: data });
      if (!await loadData()) return;
      closeModal();
      showToast(editing ? "Member details updated." : "New member added.");
    } catch (error) {
      console.error("Could not save member.", error);
      showToast(error.message);
      submitButton.disabled = false;
    }
  });
}

function closeModal() {
  modalLayer.hidden = true;
  modalLayer.innerHTML = "";
}

function updateMemberSearch() {
  const statusFilter = document.querySelector("#statusFilter")?.value || "";
  const filtered = getFilteredMembers().filter((member) => !statusFilter || member.status === statusFilter);
  const rows = document.querySelector("#membersRows");
  if (!rows) return;
  rows.innerHTML = memberRows(filtered, true);
  document.querySelector("#memberCountLabel").textContent = `Showing ${filtered.length} of ${state.members.length} members`;
}

async function handleMemberAction(button) {
  const member = state.members.find((item) => String(item.id) === button.dataset.memberId);
  if (!member) return;
  const action = button.dataset.memberAction;
  if (action === "edit") openMemberModal(member);
  if (action === "check-in" || action === "check-out") {
    try {
      await apiRequest("attendance", { method: "POST", body: { member_id: member.id, action } });
      if (await loadData()) showToast(action === "check-in" ? `${member.name} checked in.` : `${member.name} checked out.`);
    } catch (error) {
      console.error("Could not update member attendance.", error);
      showToast(error.message);
    }
  }
  if (action === "delete") {
    if (!window.confirm(`Remove ${member.name} from your member list?`)) return;
    try {
      await apiRequest("members", { method: "DELETE", id: member.id });
      if (await loadData()) showToast("Member removed.");
    } catch (error) {
      console.error("Could not remove member.", error);
      showToast(error.message);
    }
  }
}

pageContent.addEventListener("click", async (event) => {
  const pageLink = event.target.closest("[data-page-link]");
  if (pageLink) { setPage(pageLink.dataset.pageLink); return; }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    if (actionButton.dataset.action === "add-member") openMemberModal();
    else if (actionButton.dataset.action === "check-in-next") {
      const next = state.members.find((member) => member.status !== "Inactive" && !isCheckedIn(member));
      if (next) {
        try {
          await apiRequest("attendance", { method: "POST", body: { member_id: next.id, action: "check-in" } });
          if (await loadData()) showToast(`${next.name} checked in.`);
        } catch (error) {
          console.error("Could not check in member.", error);
          showToast(error.message);
        }
      } else showToast("All active members are already checked in.");
    } else if (actionButton.dataset.action === "retry") await loadData();
    return;
  }
  const memberAction = event.target.closest("[data-member-action]");
  if (memberAction) await handleMemberAction(memberAction);
});

pageContent.addEventListener("input", (event) => {
  if (event.target.id === "memberSearch") {
    memberQuery = event.target.value;
    updateMemberSearch();
  }
});
pageContent.addEventListener("change", (event) => { if (event.target.id === "statusFilter") updateMemberSearch(); });

document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => setPage(link.dataset.page)));
document.querySelector("#mobileMenu").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.querySelector("#profileButton").addEventListener("click", () => showToast("You're signed in as gym admin."));
globalSearch.addEventListener("input", () => {
  memberQuery = globalSearch.value;
  if (activePage !== "members") setPage("members");
  const localSearch = document.querySelector("#memberSearch");
  if (localSearch) { localSearch.value = memberQuery; updateMemberSearch(); }
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); globalSearch.focus(); }
  if (event.key === "Escape" && !modalLayer.hidden) closeModal();
});

todayLabel.textContent = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date());
renderPage();
loadData();
