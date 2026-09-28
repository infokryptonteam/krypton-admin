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

// ================= 1. KRYPTON REAL FIREBASE & APPS SCRIPT CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyAYLFZsORRugzjOkBnA5P4hxux517mlGfE",
  authDomain: "krypton-admin-d96be.firebaseapp.com",
  projectId: "krypton-admin-d96be",
  storageBucket: "krypton-admin-d96be.firebasestorage.app",
  messagingSenderId: "375617512339",
  appId: "1:375617512339:web:2baefdb4baa87558babe66"
};

// Connected Webhook URL for Google Sheets
const GOOGLE_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbwgX71PP4Fjf0ldE-BjaWfSLdYp8Sh2Ff0AO3sa0ZWpJgnF5EQJyJZGXDlA6xFJ6ST-Jg/exec";

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
    tIcon.className = "w-8 h-8 rounded-xl bg-krypton-tint border border-krypton-border flex items-center justify-center text-krypton flex-shrink-0";
    tIcon.innerHTML = `<i data-lucide="check" class="w-4 h-4 text-krypton-dark"></i>`;
  } else {
    tIcon.className = "w-8 h-8 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 flex-shrink-0";
    tIcon.innerHTML = `<i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600"></i>`;
  }

  if (window.lucide) lucide.createIcons();
  toast.classList.remove("translate-y-[-160%]", "opacity-0");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-[-160%]", "opacity-0");
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
    if (confirm("Lock Krypton workspace and log out?")) {
      await signOut(auth);
      showToast("Signed Out", "Session ended successfully.", false);
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

// ================= 5. REALTIME DATA SUBSCRIPTIONS =================
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

// ================= 6. KPI CALCULATIONS =================
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

// ================= 7. FORM SCHEMAS (WITH COMBOBOX & FILE/REEL URLS) =================
const schemas = {
  clients: [
    { name: "name", label: "Client or Business Name", type: "text", required: true },
    { name: "phone", label: "WhatsApp / Contact Phone", type: "text", required: true },
    { 
      name: "service", 
      label: "Selected Service (Pick or Type Custom)", 
      type: "datalist", 
      options: [
        "Web Development", 
        "Short-form Video Editing", 
        "YouTube Documentary Editing", 
        "Social Media Management", 
        "Branding & Logo Design", 
        "Performance Ads & Meta Marketing", 
        "Full Agency Retainer", 
        "SEO Optimization & Strategy"
      ],
      placeholder: "Type custom service or choose below...",
      required: true 
    },
    { name: "status", label: "Relationship Status", type: "select", options: ["Active Client", "New Lead", "Completed"] }
  ],
  projects: [
    { name: "title", label: "Project Title", type: "text", required: true },
    { name: "client", label: "Client Name", type: "text", required: true },
    { name: "budget", label: "Project Value (₹)", type: "number", required: true },
    { name: "deadline", label: "Delivery Due Date", type: "date", required: true },
    { name: "status", label: "Stage", type: "select", options: ["Planning", "In Progress", "In Review", "Completed"] },
    { name: "fileUrl", label: "Deliverable / Asset URL (Drive / Figma / Canva)", type: "url", placeholder: "https://...", required: false }
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
    { 
      name: "serviceScope", 
      label: "Scope Package (Pick or Type Custom)", 
      type: "datalist", 
      options: [
        "Daily Reels / Shorts Package (30/mo)", 
        "Alternate Days Reels (15/mo)", 
        "Complete Social Media Growth", 
        "Website Maintenance & SEO", 
        "Full Content Agency Retainer"
      ],
      placeholder: "e.g. 30 Reels / Month",
      required: true 
    },
    { name: "monthlyQuota", label: "Monthly Target Deliverables", type: "text", placeholder: "e.g. 30 Reels / Month", required: true },
    { name: "completedCount", label: "Delivered Till Date", type: "text", placeholder: "e.g. 14 Delivered", required: false },
    { name: "dailyUpdate", label: "Today's Work Log / Topic", type: "text", placeholder: "e.g. Reel #14 rendered & published", required: false },
    { name: "workUrl", label: "Delivered Reel / Post / Asset URL", type: "url", placeholder: "https://instagram.com/reel/... ya Drive Link", required: false },
    { name: "renewalDay", label: "Billing Cycle Day (e.g. 1st or 10th)", type: "text", required: true },
    { name: "subscriptionStatus", label: "Retainer State", type: "select", options: ["Active", "Paused", "Cancelled"] }
  ],
  payments: [
    { name: "client", label: "Client Name", type: "text", required: true },
    { name: "amount", label: "Amount Received (₹)", type: "number", required: true },
    { name: "type", label: "Billing Milestone", type: "select", options: ["Advance Payment (50%)", "Milestone Payment", "Final Balance", "Monthly Retainer"] },
    { name: "date", label: "Payment Date", type: "date", required: true }
  ],
  social: [
    { name: "title", label: "Content / Reel Headline", type: "text", required: true },
    { name: "platform", label: "Channel", type: "select", options: ["Instagram Reel", "YouTube Shorts", "YouTube Long-form", "LinkedIn Post"] },
    { name: "scheduledDate", label: "Publish Date", type: "date", required: true },
    { name: "status", label: "Production Status", type: "select", options: ["Idea", "Script Ready", "Editing Done", "Posted"] },
    { name: "fileUrl", label: "Media / Asset Link (Drive / Post URL)", type: "url", placeholder: "https://...", required: false }
  ],
  team: [
    { name: "fullName", label: "Member Name", type: "text", required: true },
    { name: "role", label: "Primary Role", type: "select", options: ["Web Developer", "Video Editor", "Motion Designer", "Copywriter", "Growth Strategist"] },
    { name: "contact", label: "Contact (Phone / Email)", type: "text", required: true },
    { name: "status", label: "Availability", type: "select", options: ["Available", "Engaged on Project", "On Leave"] }
  ]
};

// ================= 8. MODAL HANDLERS & DUAL SYNC =================
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
    recurring: "Recurring Client / Retainer",
    payments: "Payment Record",
    social: "Social Post",
    team: "Team Member"
  };

  const target = tab === "dashboard" ? "clients" : tab;
  if (modalTitle) modalTitle.textContent = `New ${displayNames[target] || "Record"}`;
  if (formFieldsContainer) formFieldsContainer.innerHTML = "";
  const fields = schemas[target] || [];

  fields.forEach(f => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<label class="block text-xs font-bold text-slate-700 mb-1">${f.label}</label>`;

    if (f.type === "datalist") {
      const listId = `dl_${f.name}_${Date.now()}`;
      const input = document.createElement("input");
      input.setAttribute("list", listId);
      input.name = f.name;
      input.placeholder = f.placeholder || "Type custom or select from list...";
      if (f.required) input.required = true;
      input.className = "w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl text-slate-800 outline-none krypton-input transition placeholder-slate-400";
      
      const datalist = document.createElement("datalist");
      datalist.id = listId;
      (f.options || []).forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        datalist.appendChild(option);
      });
      wrap.appendChild(input);
      wrap.appendChild(datalist);
    } 
    else if (f.type === "select") {
      const select = document.createElement("select");
      select.name = f.name;
      select.className = "w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl text-slate-800 outline-none krypton-input transition";
      f.options.forEach(opt => {
        const option = document.createElement("option");
        option.value = opt;
        select.appendChild(option);
      });
      wrap.appendChild(select);
    } 
    else {
      const input = document.createElement("input");
      input.type = f.type;
      input.name = f.name;
      if (f.required) input.required = true;
      if (f.placeholder) input.placeholder = f.placeholder;
      input.className = "w-full bg-slate-50 border border-slate-200 text-xs px-3.5 py-2.5 rounded-xl text-slate-800 outline-none krypton-input transition placeholder-slate-400";
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
      // 1. Save to Firebase
      await addDoc(collection(db, targetCollection), payload);

      // 2. Dual Sync to Google Sheets
      if (GOOGLE_SHEET_WEBHOOK_URL) {
        fetch(GOOGLE_SHEET_WEBHOOK_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            moduleType: targetCollection,
            ...payload
          })
        }).catch(err => console.warn("Google Sheet sync notice:", err));
      }

      showToast("Saved Successfully", "Data updated in Firebase and Google Sheets.");
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
  if (confirm("Delete this entry from workspace records?")) {
    await deleteDoc(doc(db, col, id));
    showToast("Deleted", "Record has been removed.");
  }
};

// ================= 9. EXPORT DATA TO EXCEL / CSV =================
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

// ================= 10. REFRESH BUTTON =================
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

// ================= 11. RENDER ENGINE (KRYPTON EMERALD ACCENTS) =================
const container = document.getElementById("tabContentContainer");
const sectionTitle = document.getElementById("currentSectionTitle");
const newEntryBtnLabel = document.getElementById("newEntryBtnLabel");
const recordCountLabel = document.getElementById("recordCountLabel");

const titleMap = {
  dashboard: "Overview Dashboard",
  clients: "Clients Directory",
  projects: "Project Pipelines",
  tasks: "Operational Tasks",
  payments: "Payment Transactions",
  recurring: "Recurring Clients & Retainers",
  social: "Social Posts & Content Calendar",
  reports: "Financial Overview",
  team: "Agency Team Roster"
};

const buttonLabelMap = {
  dashboard: "Add Client",
  clients: "Add Client",
  projects: "Add Project",
  tasks: "Add Task",
  payments: "Add Payment",
  recurring: "Add Retainer / Quota",
  social: "Add Social Post",
  reports: "Add Record",
  team: "Add Team Member"
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
      <thead class="bg-slate-50 text-[11px] font-bold text-slate-500 border-b border-slate-200">
        <tr>
          ${headers.map(h => `<th class="px-5 py-3">${h}</th>`).join("")}
          <th class="px-5 py-3 text-right">Action</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 font-medium">
  `;

  list.forEach(row => {
    tableHtml += `<tr class="hover:bg-slate-50/70 transition">`;
    (schemas[tab] || []).forEach(field => {
      let val = row[field.name] || "-";
      
      // File / Reel / Media URL handling
      if (field.name === "fileUrl" || field.name === "workUrl") {
        if (val && val !== "-" && (val.startsWith("http://") || val.startsWith("https://"))) {
          const btnText = field.name === "workUrl" ? "View Reel" : "Open Link";
          val = `<a href="${val}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center space-x-1 px-2.5 py-1 bg-krypton-tint hover:bg-emerald-100 text-krypton-dark rounded-lg font-bold transition border border-krypton-border">
            <span>${btnText}</span>
            <i data-lucide="external-link" class="w-3 h-3 text-krypton"></i>
          </a>`;
        } else {
          val = `<span class="text-slate-400 italic">None</span>`;
        }
      }
      else if (field.name === "completedCount") {
        val = `<span class="font-bold text-krypton-dark bg-krypton-tint border border-krypton-border px-2 py-0.5 rounded-md">${val}</span>`;
      }
      else if (field.name === "dailyUpdate") {
        val = `<span class="text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded-md block max-w-xs truncate" title="${val}">${val}</span>`;
      }
      else if (field.name === "budget" || field.name === "amount" || field.name === "monthlyFee") {
        val = `<span class="font-bold font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">₹${Number(val).toLocaleString()}</span>`;
      } 
      else if (field.name === "status" || field.name === "subscriptionStatus" || field.name === "priority") {
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (val === "Active" || val === "Active Client" || val === "Completed" || val === "Done" || val === "Posted") {
          badgeColor = "bg-krypton-tint text-krypton-dark font-bold border-krypton-border";
        } else if (val === "In Progress" || val === "High" || val === "Urgent") {
          badgeColor = "bg-amber-50 text-amber-800 border-amber-200 font-bold";
        } else if (val === "Cancelled" || val === "On Leave") {
          badgeColor = "bg-rose-50 text-rose-700 border-rose-200 font-bold";
        }
        val = `<span class="px-2.5 py-0.5 rounded-full text-[11px] border ${badgeColor}">${val}</span>`;
      }
      tableHtml += `<td class="px-5 py-3 text-slate-800">${val}</td>`;
    });
    tableHtml += `
      <td class="px-5 py-3 text-right">
        <button onclick="deleteEntity('${tab}', '${row.id}')" class="text-rose-600 hover:text-rose-800 font-bold p-1 hover:bg-rose-50 rounded-lg transition text-[11px]">Delete</button>
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
      <!-- Clean Welcome Banner with Krypton Glow -->
      <div class="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm relative overflow-hidden">
        <div class="space-y-1 z-10">
          <span class="inline-flex items-center gap-1.5 bg-white/10 text-krypton-bright px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase">
            <span class="w-1.5 h-1.5 rounded-full bg-krypton-bright animate-pulse"></span> Krypton Command Center
          </span>
          <h3 class="text-lg font-bold text-white">Welcome back to Krypton Operations</h3>
          <p class="text-xs text-slate-300">All systems synchronized with Cloud Firestore & Google Sheets.</p>
        </div>
        <button onclick="document.querySelector('[data-tab=recurring]').click()" class="z-10 px-4 py-2 rounded-xl bg-krypton hover:bg-krypton-hover text-white font-bold text-xs transition shadow-md krypton-glow active:scale-95">
          View Retainers Tracker
        </button>
        <div class="absolute -right-8 -bottom-8 w-36 h-36 bg-krypton/20 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      <!-- Activity Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- Active Projects -->
        <div class="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <i data-lucide="folder-kanban" class="w-3.5 h-3.5 text-krypton"></i> Active Projects
            </h4>
            <span class="text-xs font-mono font-bold text-slate-400">${state.data.projects.length} Total</span>
          </div>
          <div class="space-y-2">
            ${recentProjects.length === 0 ? '<p class="text-xs text-slate-400 py-4 text-center">No projects in pipeline.</p>' : recentProjects.map(p => `
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p class="text-xs font-bold text-slate-800">${p.title || "Untitled"}</p>
                  <p class="text-[11px] text-slate-500">Client: ${p.client || "-"}</p>
                </div>
                <div class="text-right">
                  <span class="text-xs font-bold font-mono text-slate-900">₹${Number(p.budget || 0).toLocaleString()}</span>
                  <span class="block text-[10px] text-slate-500 font-medium">${p.status || "Planning"}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Priority Tasks -->
        <div class="border border-slate-200 rounded-2xl p-4 bg-white shadow-sm">
          <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <i data-lucide="alert-circle" class="w-3.5 h-3.5 text-amber-500"></i> Priority Tasks
            </h4>
            <span class="text-xs font-mono font-bold text-slate-400">${state.data.tasks.length} Total</span>
          </div>
          <div class="space-y-2">
            ${urgentTasks.length === 0 ? '<p class="text-xs text-slate-400 py-4 text-center">No urgent tasks pending.</p>' : urgentTasks.map(t => `
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <div>
                  <p class="text-xs font-bold text-slate-800">${t.task || "Task"}</p>
                  <p class="text-[11px] text-slate-500">Assigned: ${t.assignee || "-"}</p>
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
      <div class="bg-krypton-tint border border-krypton-border p-5 rounded-2xl shadow-sm">
        <span class="text-[11px] font-extrabold text-krypton-dark uppercase tracking-wider">Active Monthly Retainers (MRR)</span>
        <h4 class="text-2xl font-black text-krypton-dark mt-1.5 font-mono">₹${activeMRR.toLocaleString()}/mo</h4>
        <p class="text-xs text-slate-500 mt-1">Predictable monthly revenue run-rate</p>
      </div>
      <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <span class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Total Received Funds</span>
        <h4 class="text-2xl font-black text-slate-900 mt-1.5 font-mono">₹${rev.toLocaleString()}</h4>
        <p class="text-xs text-slate-400 mt-1">Collected payment balance</p>
      </div>
      <div class="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
        <span class="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Pipeline Valuation</span>
        <h4 class="text-2xl font-black text-slate-900 mt-1.5 font-mono">₹${totalPipeline.toLocaleString()}</h4>
        <p class="text-xs text-slate-400 mt-1">Total active scope commitment</p>
      </div>
    </div>
  `;
}

// ================= 14. TAB SWITCHING ENGINE =================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.className = "tab-btn w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition";
    });
    btn.className = "tab-btn w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-bold bg-krypton-tint text-krypton-dark border border-krypton-border transition";
    
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
