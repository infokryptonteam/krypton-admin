import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

// ================= 1. KRYPTON REAL FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyAYLFZsORRugzjOkBnA5P4hxux517mlGfE",
  authDomain: "krypton-admin-d96be.firebaseapp.com",
  projectId: "krypton-admin-d96be",
  storageBucket: "krypton-admin-d96be.firebasestorage.app",
  messagingSenderId: "375617512339",
  appId: "1:375617512339:web:2baefdb4baa87558babe66"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// State Store
const state = {
  currentTab: "dashboard",
  searchQuery: "",
  data: {
    clients: [],
    projects: [],
    tasks: [],
    recurring: [],
    payments: [],
    social: [],
    team: []
  }
};

// ================= 2. TOAST NOTIFICATION UTILITY =================
function showToast(title, message, isSuccess = true) {
  const toast = document.getElementById("toastNotification");
  const tTitle = document.getElementById("toastTitle");
  const tMsg = document.getElementById("toastMessage");
  const tIcon = document.getElementById("toastIcon");

  if (!toast || !tTitle || !tMsg || !tIcon) return;

  tTitle.textContent = title;
  tMsg.textContent = message;

  if (isSuccess) {
    tIcon.className = "w-8 h-8 rounded-xl bg-krypton-tint border border-krypton-border flex items-center justify-center text-krypton-dark flex-shrink-0";
    tIcon.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-emerald-600"></i>`;
  } else {
    tIcon.className = "w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0";
    tIcon.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600"></i>`;
  }

  if (window.lucide) lucide.createIcons();
  toast.classList.remove("translate-y-[-150%]", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-[-150%]", "opacity-0");
  }, 3500);
}

// ================= 3. AUTHENTICATION & PORTAL WELCOME =================
const authScreen = document.getElementById("authScreen");
const loginForm = document.getElementById("loginForm");
const authError = document.getElementById("authError");
const userEmailBadge = document.getElementById("userEmailBadge");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add("hidden");
    const namePart = user.email.split("@")[0];
    if (userEmailBadge) userEmailBadge.textContent = namePart.toUpperCase();
    showToast("Access Granted", `Welcome back, ${namePart}! Krypton portal ready.`);
    initLiveSubscriptions();
  } else {
    authScreen.classList.remove("hidden");
  }
});

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (authError) authError.classList.add("hidden");
    const email = document.getElementById("authEmail").value;
    const pass = document.getElementById("authPass").value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      if (authError) {
        authError.textContent = "Invalid admin credentials. Please re-check.";
        authError.classList.remove("hidden");
      }
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    if (confirm("Are you sure you want to lock the Krypton workspace and log out?")) {
      await signOut(auth);
      showToast("Logged Out", "Workspace locked successfully.", false);
    }
  });
}

// ================= 4. MOBILE DRAWER NAVIGATION =================
const mobileMenuToggle = document.getElementById("mobileMenuToggle");
const closeSidebarBtn = document.getElementById("closeSidebarBtn");
const sidebar = document.getElementById("sidebar");

if (mobileMenuToggle && sidebar) {
  mobileMenuToggle.addEventListener("click", () => {
    sidebar.classList.remove("-translate-x-full");
  });
}

if (closeSidebarBtn && sidebar) {
  closeSidebarBtn.addEventListener("click", () => {
    sidebar.classList.add("-translate-x-full");
  });
}

// ================= 5. REALTIME DATA SYNC =================
let unsubscribers = [];
const collections = ["clients", "projects", "tasks", "recurring", "payments", "social", "team"];

function initLiveSubscriptions() {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  collections.forEach(colName => {
    const unsub = onSnapshot(collection(db, colName), (snap) => {
      const records = [];
      snap.forEach(d => records.push({ id: d.id, ...d.data() }));
      state.data[colName] = records;
      updateDashboardCounts();
      renderActiveTab();
    });
    unsubscribers.push(unsub);
  });
}

// ================= 6. KPI METRICS =================
function updateDashboardCounts() {
  const elClients = document.getElementById("statClients");
  const elProjects = document.getElementById("statProjects");
  const elTasks = document.getElementById("statTasks");
  const elMRR = document.getElementById("statMRR");
  const elRev = document.getElementById("statRevenue");

  if (elClients) elClients.textContent = state.data.clients.length;
  
  const activeProjects = state.data.projects.filter(p => p.status !== "Completed").length;
  if (elProjects) elProjects.textContent = activeProjects;

  const pendingTasks = state.data.tasks.filter(t => t.status !== "Done").length;
  if (elTasks) elTasks.textContent = pendingTasks;

  const monthlyTotal = state.data.recurring
    .filter(r => r.subscriptionStatus === "Active")
    .reduce((acc, curr) => acc + (Number(curr.monthlyFee) || 0), 0);
  if (elMRR) elMRR.textContent = `₹${monthlyTotal.toLocaleString()}`;

  const totalRev = state.data.payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  if (elRev) elRev.textContent = `₹${totalRev.toLocaleString()}`;
}

// ================= 7. FORM SCHEMAS =================
const schemas = {
  clients: [
    { name: "name", label: "Client or Business Name", type: "text", required: true },
    { name: "phone", label: "WhatsApp / Contact", type: "text", required: true },
    { name: "service", label: "Selected Service", type: "select", options: ["Web Development", "Video Editing", "Branding & Visuals", "Social Media Growth", "Full Retainer"] },
    { name: "status", label: "Relationship Status", type: "select", options: ["Active Client", "New Lead", "Completed"] }
  ],
  projects: [
    { name: "title", label: "Project Title", type: "text", required: true },
    { name: "client", label: "Client Name", type: "text", required: true },
    { name: "budget", label: "Project Value (₹)", type: "number", required: true },
    { name: "deadline", label: "Delivery Due Date", type: "date", required: true },
    { name: "status", label: "Execution Stage", type: "select", options: ["Planning", "In Progress", "In Review", "Completed"] }
  ],
  tasks: [
    { name: "task", label: "Task Description", type: "text", required: true },
    { name: "assignee", label: "Assigned To", type: "text", required: true },
    { name: "priority", label: "Priority Level", type: "select", options: ["Normal", "High", "Urgent"] },
    { name: "status", label: "Progress Status", type: "select", options: ["To Do", "In Progress", "Done"] }
  ],
  recurring: [
    { name: "clientName", label: "Client / Brand", type: "text", required: true },
    { name: "monthlyFee", label: "Monthly Retainer (₹)", type: "number", required: true },
    { name: "serviceScope", label: "Scope Package", type: "select", options: ["Video Editing Package", "Social Media Management", "Website Maintenance", "Full Agency Retainer"] },
    { name: "renewalDay", label: "Billing Cycle Day (e.g. 1st or 10th)", type: "text", required: true },
    { name: "subscriptionStatus", label: "Retainer State", type: "select", options: ["Active", "Paused", "Cancelled"] }
  ],
  payments: [
    { name: "client", label: "Client Name", type: "text", required: true },
    { name: "amount", label: "Amount Received (₹)", type: "number", required: true },
    { name: "type", label: "Billing Milestones", type: "select", options: ["Advance Payment (50%)", "Milestone Payment", "Final Balance", "Monthly Retainer"] },
    { name: "date", label: "Payment Date", type: "date", required: true }
  ],
  social: [
    { name: "title", label: "Content / Reel Headline", type: "text", required: true },
    { name: "platform", label: "Distribution Channel", type: "select", options: ["Instagram Reel", "YouTube Shorts", "YouTube Long-form", "LinkedIn"] },
    { name: "scheduledDate", label: "Publish Date", type: "date", required: true },
    { name: "status", label: "Production Status", type: "select", options: ["Idea", "Script Ready", "Editing Done", "Posted"] }
  ],
  team: [
    { name: "fullName", label: "Member Name", type: "text", required: true },
    { name: "role", label: "Primary Role", type: "select", options: ["Web Developer", "Video Editor", "Motion Designer", "Copywriter", "Growth Strategist"] },
    { name: "contact", label: "Phone or Email", type: "text", required: true },
    { name: "status", label: "Availability", type: "select", options: ["Available", "Engaged on Project", "On Leave"] }
  ]
};

// ================= 8. MODAL HANDLERS =================
const entryModal = document.getElementById("entryModal");
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const universalForm = document.getElementById("universalForm");
const formFieldsContainer = document.getElementById("formFieldsContainer");
const modalTitle = document.getElementById("modalTitle");

function openModalForTab(tab) {
  const displayNames = {
    clients: "Client",
    projects: "Project",
    tasks: "Task",
    recurring: "Recurring Client",
    payments: "Payment Record",
    social: "Social Media Post",
    team: "Team Member"
  };

  const target = tab === "dashboard" ? "clients" : tab;
  if (modalTitle) modalTitle.textContent = `New ${displayNames[target] || "Record"}`;
  if (formFieldsContainer) formFieldsContainer.innerHTML = "";
  const fields = schemas[target] || [];

  fields.forEach(f => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<label class="block text-xs font-semibold text-slate-700 mb-1">${f.label}</label>`;
    if (f.type === "select") {
      const select = document.createElement("select");
      select.name = f.name;
      select.className = "w-full bg-slate-50 border border-slate-300 text-xs px-3.5 py-2.5 rounded-xl text-slate-800 outline-none krypton-border-focus transition";
      f.options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        option.textContent = opt;
        select.appendChild(option);
      });
      wrap.appendChild(select);
    } else {
      const input = document.createElement("input");
      input.type = f.type;
      input.name = f.name;
      if (f.required) input.required = true;
      input.className = "w-full bg-slate-50 border border-slate-300 text-xs px-3.5 py-2.5 rounded-xl text-slate-800 outline-none krypton-border-focus transition";
      wrap.appendChild(input);
    }
    if (formFieldsContainer) formFieldsContainer.appendChild(wrap);
  });

  if (entryModal) {
    entryModal.classList.remove("hidden");
    entryModal.classList.add("flex");
  }
}

if (openModalBtn) {
  openModalBtn.addEventListener("click", () => openModalForTab(state.currentTab));
}

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    if (entryModal) {
      entryModal.classList.add("hidden");
      entryModal.classList.remove("flex");
    }
  });
}

if (universalForm) {
  universalForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(universalForm);
    const payload = Object.fromEntries(formData.entries());
    payload.createdAt = serverTimestamp();

    const targetCollection = state.currentTab === "dashboard" ? "clients" : state.currentTab;

    try {
      await addDoc(collection(db, targetCollection), payload);
      showToast("Record Synchronized", "Data updated live to cloud storage.");
      universalForm.reset();
      if (entryModal) {
        entryModal.classList.add("hidden");
        entryModal.classList.remove("flex");
      }
    } catch (err) {
      showToast("Error", err.message, false);
    }
  });
}

window.deleteEntity = async (col, id) => {
  if (confirm("Delete this entry permanently from Krypton records?")) {
    await deleteDoc(doc(db, col, id));
    showToast("Deleted", "Record has been removed.");
  }
};

// ================= 9. EXPORT DATA TO EXCEL / CSV (FIXED) =================
const exportCsvBtn = document.getElementById("exportCsvBtn");
if (exportCsvBtn) {
  exportCsvBtn.addEventListener("click", () => {
    const tab = state.currentTab;
    let exportData = [];
    let filename = `krypton_${tab}_export.csv`;

    if (tab === "dashboard" || tab === "reports") {
      const allClients = state.data.clients.map(c => ({
        Module: "Client",
        Title: c.name || "",
        Contact: c.phone || "",
        Detail: c.service || "",
        Status: c.status || ""
      }));
      const allProjects = state.data.projects.map(p => ({
        Module: "Project",
        Title: p.title || "",
        Contact: p.client || "",
        Detail: `Rs. ${p.budget || 0}`,
        Status: p.status || ""
      }));
      const allPayments = state.data.payments.map(m => ({
        Module: "Payment",
        Title: m.client || "",
        Contact: m.date || "",
        Detail: `Rs. ${m.amount || 0}`,
        Status: m.type || ""
      }));
      exportData = [...allClients, ...allProjects, ...allPayments];
      filename = "krypton_master_summary.csv";
    } else {
      exportData = state.data[tab] || [];
    }

    if (!exportData || exportData.length === 0) {
      alert("No data available to export in this section yet! Please add records first.");
      return;
    }

    const keys = Object.keys(exportData[0]).filter(k => k !== "id" && k !== "createdAt");
    
    // Add UTF-8 BOM so Excel opens text, rupee symbols cleanly
    let csvContent = "\uFEFF";
    csvContent += keys.join(",") + "\r\n";

    exportData.forEach(row => {
      const line = keys.map(k => {
        let val = row[k] !== undefined && row[k] !== null ? String(row[k]) : "";
        val = val.replace(/"/g, '""');
        return `"${val}"`;
      }).join(",");
      csvContent += line + "\r\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Excel Exported", `${filename} downloaded successfully.`);
  });
}

// ================= 10. REFRESH BUTTON (FIXED) =================
const refreshBtn = document.getElementById("refreshBtn");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    refreshBtn.classList.add("animate-spin");
    initLiveSubscriptions();
    showToast("Syncing", "Workspace re-synced with Google Cloud.");
    setTimeout(() => {
      refreshBtn.classList.remove("animate-spin");
    }, 700);
  });
}

// ================= 11. RENDER ENGINE =================
const container = document.getElementById("tabContentContainer");
const sectionTitle = document.getElementById("currentSectionTitle");
const newEntryBtnLabel = document.getElementById("newEntryBtnLabel");
const recordCountLabel = document.getElementById("recordCountLabel");

const titleMap = {
  dashboard: "Overview Dashboard",
  clients: "Clients Directory",
  projects: "Project Pipelines",
  tasks: "Operational Tasks",
  recurring: "Recurring Clients & Retainers",
  payments: "Payment Transactions",
  social: "Content Calendar",
  team: "Agency Roster",
  reports: "Executive Financial Summary"
};

const buttonLabelMap = {
  dashboard: "Add Client",
  clients: "Add Client",
  projects: "Add Project",
  tasks: "Add Task",
  recurring: "Add Retainer",
  payments: "Add Payment",
  social: "Add Content",
  team: "Add Member"
};

function renderActiveTab() {
  const tab = state.currentTab;
  if (sectionTitle) sectionTitle.textContent = titleMap[tab] || "Portal View";
  if (newEntryBtnLabel) newEntryBtnLabel.textContent = buttonLabelMap[tab] || "Add Entry";

  if (tab === "dashboard") {
    renderDashboardView();
    return;
  }

  if (tab === "reports") {
    renderReportsView();
    return;
  }

  let list = state.data[tab] || [];

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(q))
    );
  }

  if (recordCountLabel) recordCountLabel.textContent = `${list.length} Records`;

  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center text-slate-400 text-xs">
        <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        No active records found in this category.
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const headers = (schemas[tab] || []).map(s => s.label);
  let tableHtml = `
    <table class="w-full text-left text-xs text-slate-700">
      <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200 uppercase tracking-wider">
        <tr>
          ${headers.map(h => `<th class="px-5 py-3.5">${h}</th>`).join("")}
          <th class="px-5 py-3.5 text-right">Action</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 font-medium">
  `;

  list.forEach(row => {
    tableHtml += `<tr class="hover:bg-slate-50/80 transition">`;
    (schemas[tab] || []).forEach(field => {
      let val = row[field.name] || "-";
      
      if (field.name === "budget" || field.name === "amount" || field.name === "monthlyFee") {
        val = `<span class="font-mono font-bold text-slate-900 bg-krypton-tint border border-krypton-border px-2 py-0.5 rounded-lg">₹${Number(val).toLocaleString()}</span>`;
      } 
      else if (field.name === "status" || field.name === "subscriptionStatus" || field.name === "priority") {
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (val === "Active" || val === "Active Client" || val === "Completed" || val === "Done" || val === "Posted") {
          badgeColor = "bg-emerald-50 text-emerald-800 font-bold border-emerald-200";
        } else if (val === "In Progress" || val === "High" || val === "Urgent") {
          badgeColor = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
        } else if (val === "Cancelled" || val === "On Leave") {
          badgeColor = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
        }
        val = `<span class="px-2.5 py-0.5 rounded-full text-[11px] border ${badgeColor}">${val}</span>`;
      }
      tableHtml += `<td class="px-5 py-3.5 text-slate-800">${val}</td>`;
    });
    tableHtml += `
      <td class="px-5 py-3.5 text-right">
        <button onclick="deleteEntity('${tab}', '${row.id}')" class="text-rose-600 hover:text-rose-800 font-semibold p-1 hover:bg-rose-50 rounded-lg transition">Remove</button>
      </td>
    </tr>`;
  });

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
  if (window.lucide) lucide.createIcons();
}

// ================= 12. OVERVIEW DASHBOARD VIEW =================
function renderDashboardView() {
  if (recordCountLabel) recordCountLabel.textContent = "Live Summary";
  const recentProjects = state.data.projects.slice(0, 4);
  const urgentTasks = state.data.tasks.filter(t => t.priority === "Urgent" || t.priority === "High").slice(0, 4);

  if (!container) return;

  container.innerHTML = `
    <div class="p-6 space-y-6">
      <!-- Welcome Banner -->
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="space-y-1 z-10">
          <span class="inline-block bg-krypton-neon/20 border border-krypton-neon/40 text-krypton-neon px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider">Agency Command Center</span>
          <h3 class="text-xl font-black text-white">Welcome back to Krypton Operations</h3>
          <p class="text-xs text-slate-300">All modules synchronized in real-time with Google Cloud.</p>
        </div>
        <button onclick="document.querySelector('[data-tab=projects]').click()" class="z-10 px-4 py-2.5 rounded-xl bg-krypton-neon text-slate-950 font-bold text-xs shadow krypton-glow active:scale-95 transition">
          View Projects Pipeline
        </button>
        <div class="absolute -right-10 -bottom-10 w-44 h-44 bg-krypton-neon/15 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <!-- Two Column Activity Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Recent Projects -->
        <div class="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <i data-lucide="folder-kanban" class="w-4 h-4 text-emerald-600"></i> Active Projects
            </h4>
            <span class="text-[11px] text-slate-400">${state.data.projects.length} Total</span>
          </div>
          <div class="space-y-2.5">
            ${recentProjects.length === 0 ? '<p class="text-xs text-slate-400 py-4 text-center">No projects added yet.</p>' : recentProjects.map(p => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p class="text-xs font-bold text-slate-800">${p.title || "Untitled"}</p>
                  <p class="text-[11px] text-slate-400">Client: ${p.client || "-"}</p>
                </div>
                <div class="text-right">
                  <span class="text-xs font-mono font-bold text-slate-900">₹${Number(p.budget || 0).toLocaleString()}</span>
                  <span class="block text-[10px] text-slate-500 font-semibold">${p.status || "Planning"}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- High Priority Tasks -->
        <div class="border border-slate-200 rounded-2xl p-5 bg-white shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <i data-lucide="alert-circle" class="w-4 h-4 text-amber-500"></i> Priority Tasks
            </h4>
            <span class="text-[11px] text-slate-400">${state.data.tasks.length} Total</span>
          </div>
          <div class="space-y-2.5">
            ${urgentTasks.length === 0 ? '<p class="text-xs text-slate-400 py-4 text-center">No urgent tasks pending.</p>' : urgentTasks.map(t => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p class="text-xs font-bold text-slate-800">${t.task || "Task"}</p>
                  <p class="text-[11px] text-slate-400">Assigned: ${t.assignee || "-"}</p>
                </div>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">${t.priority || "High"}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

// ================= 13. REPORTS SUMMARY VIEW =================
function renderReportsView() {
  const rev = state.data.payments.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const totalPipeline = state.data.projects.reduce((acc, p) => acc + (Number(p.budget) || 0), 0);
  const activeMRR = state.data.recurring
    .filter(r => r.subscriptionStatus === "Active")
    .reduce((acc, curr) => acc + (Number(curr.monthlyFee) || 0), 0);

  if (!container) return;

  container.innerHTML = `
    <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-krypton-tint border-2 border-krypton-neon p-6 rounded-2xl shadow-sm">
        <span class="text-[11px] font-extrabold text-krypton-dark uppercase tracking-wider">Active Monthly Retainers (MRR)</span>
        <h4 class="text-3xl font-black text-slate-950 mt-2 font-mono">₹${activeMRR.toLocaleString()}/mo</h4>
        <p class="text-xs text-slate-600 mt-1 font-medium">Predictable monthly revenue run-rate</p>
      </div>
      <div class="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <span class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Received Funds</span>
        <h4 class="text-3xl font-black text-slate-900 mt-2 font-mono">₹${rev.toLocaleString()}</h4>
        <p class="text-xs text-slate-500 mt-1 font-medium">Recorded payment income</p>
      </div>
      <div class="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <span class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Project Pipeline Valuation</span>
        <h4 class="text-3xl font-black text-slate-900 mt-2 font-mono">₹${totalPipeline.toLocaleString()}</h4>
        <p class="text-xs text-slate-500 mt-1 font-medium">Accumulated project scope volume</p>
      </div>
    </div>
  `;
}

// ================= 14. TAB SWITCHING =================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.className = "tab-btn w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition";
    });
    btn.className = "tab-btn w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-bold bg-krypton-neon text-slate-950 krypton-glow transition";
    
    state.currentTab = btn.getAttribute("data-tab");
    if (openModalBtn) openModalBtn.style.display = state.currentTab === "reports" ? "none" : "flex";
    
    if (sidebar) sidebar.classList.add("-translate-x-full");
    
    renderActiveTab();
  });
});

const searchInput = document.getElementById("globalSearch");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderActiveTab();
  });
}

// Initial boot
if (window.lucide) lucide.createIcons();
