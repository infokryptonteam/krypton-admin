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
  currentTab: "clients",
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

// ================= 2. AUTHENTICATION =================
const authScreen = document.getElementById("authScreen");
const loginForm = document.getElementById("loginForm");
const authError = document.getElementById("authError");
const userEmailBadge = document.getElementById("userEmailBadge");
const logoutBtn = document.getElementById("logoutBtn");

onAuthStateChanged(auth, (user) => {
  if (user) {
    authScreen.classList.add("hidden");
    userEmailBadge.textContent = user.email.split("@")[0];
    initLiveSubscriptions();
  } else {
    authScreen.classList.remove("hidden");
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPass").value;
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (err) {
    authError.textContent = err.message;
    authError.classList.remove("hidden");
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

// ================= 3. REALTIME DATA SYNC =================
let unsubscribers = [];
const collections = ["clients", "projects", "tasks", "recurring", "payments", "social", "team"];

function initLiveSubscriptions() {
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  collections.forEach(colName => {
    const unsub = onSnapshot(collection(db, colName), (snap) => {
      const records = [];
      snap.forEach(doc => records.push({ id: doc.id, ...doc.data() }));
      state.data[colName] = records;
      updateDashboardCounts();
      renderActiveTab();
    });
    unsubscribers.push(unsub);
  });
}

// ================= 4. DASHBOARD COUNTS =================
function updateDashboardCounts() {
  document.getElementById("statClients").textContent = state.data.clients.length;
  
  const activeProjects = state.data.projects.filter(p => p.status !== "Completed").length;
  document.getElementById("statProjects").textContent = activeProjects;

  const pendingTasks = state.data.tasks.filter(t => t.status !== "Done").length;
  document.getElementById("statTasks").textContent = pendingTasks;

  const monthlyTotal = state.data.recurring
    .filter(r => r.subscriptionStatus === "Active")
    .reduce((acc, curr) => acc + (Number(curr.monthlyFee) || 0), 0);
  document.getElementById("statMRR").textContent = `₹${monthlyTotal.toLocaleString()}`;

  const totalRev = state.data.payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  document.getElementById("statRevenue").textContent = `₹${totalRev.toLocaleString()}`;
}

// ================= 5. FORM SCHEMAS (SIMPLE ENGLISH) =================
const schemas = {
  clients: [
    { name: "name", label: "Client or Business Name", type: "text", required: true },
    { name: "phone", label: "Phone / WhatsApp", type: "text", required: true },
    { name: "service", label: "Service Needed", type: "select", options: ["Web Development", "Video Editing", "Graphic Design", "Social Media Management"] },
    { name: "status", label: "Status", type: "select", options: ["New Lead", "Active Client", "Completed"] }
  ],
  projects: [
    { name: "title", label: "Project Name", type: "text", required: true },
    { name: "client", label: "Client Name", type: "text", required: true },
    { name: "budget", label: "Total Price (₹)", type: "number", required: true },
    { name: "deadline", label: "Due Date", type: "date", required: true },
    { name: "status", label: "Project Status", type: "select", options: ["Planning", "In Progress", "In Review", "Completed"] }
  ],
  tasks: [
    { name: "task", label: "Task Details", type: "text", required: true },
    { name: "assignee", label: "Assigned Person", type: "text", required: true },
    { name: "priority", label: "Priority", type: "select", options: ["Normal", "High", "Urgent"] },
    { name: "status", label: "Status", type: "select", options: ["To Do", "In Progress", "Done"] }
  ],
  recurring: [
    { name: "clientName", label: "Client Name", type: "text", required: true },
    { name: "monthlyFee", label: "Monthly Amount (₹)", type: "number", required: true },
    { name: "serviceScope", label: "Monthly Service", type: "select", options: ["Reels & Shorts Package", "Social Media Handling", "Website Maintenance", "Full Agency Retainer"] },
    { name: "renewalDay", label: "Billing Day of the Month (e.g. 5th)", type: "text", required: true },
    { name: "subscriptionStatus", label: "Status", type: "select", options: ["Active", "Paused", "Cancelled"] }
  ],
  payments: [
    { name: "client", label: "Client Name", type: "text", required: true },
    { name: "amount", label: "Amount Paid (₹)", type: "number", required: true },
    { name: "type", label: "Payment Type", type: "select", options: ["Advance Payment", "Part Payment", "Full Payment", "Monthly Fee"] },
    { name: "date", label: "Payment Date", type: "date", required: true }
  ],
  social: [
    { name: "title", label: "Post / Video Topic", type: "text", required: true },
    { name: "platform", label: "Platform", type: "select", options: ["Instagram Reel", "YouTube Video", "YouTube Shorts", "LinkedIn"] },
    { name: "scheduledDate", label: "Publish Date", type: "date", required: true },
    { name: "status", label: "Status", type: "select", options: ["Idea", "Script Ready", "Editing Done", "Posted"] }
  ],
  team: [
    { name: "fullName", label: "Member Name", type: "text", required: true },
    { name: "role", label: "Role / Skill", type: "select", options: ["Web Developer", "Video Editor", "Graphic Designer", "Content Writer"] },
    { name: "contact", label: "Phone or Email", type: "text", required: true },
    { name: "status", label: "Availability", type: "select", options: ["Available", "Busy on Project", "On Leave"] }
  ]
};

// ================= 6. MODAL & FORMS =================
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
    payments: "Payment",
    social: "Social Post",
    team: "Team Member"
  };

  modalTitle.textContent = `Add ${displayNames[tab] || "Entry"}`;
  formFieldsContainer.innerHTML = "";
  const fields = schemas[tab] || [];

  fields.forEach(f => {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<label class="block text-xs font-semibold text-slate-600 mb-1">${f.label}</label>`;
    if (f.type === "select") {
      const select = document.createElement("select");
      select.name = f.name;
      select.className = "w-full bg-slate-50 border border-slate-300 text-sm px-3.5 py-2.5 rounded-xl text-slate-800 outline-none focus:border-krypton-neon focus:bg-white focus:ring-4 focus:ring-krypton-glow transition";
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
      input.className = "w-full bg-slate-50 border border-slate-300 text-sm px-3.5 py-2.5 rounded-xl text-slate-800 outline-none focus:border-krypton-neon focus:bg-white focus:ring-4 focus:ring-krypton-glow transition";
      wrap.appendChild(input);
    }
    formFieldsContainer.appendChild(wrap);
  });

  entryModal.classList.remove("hidden");
  entryModal.classList.add("flex");
}

openModalBtn.addEventListener("click", () => openModalForTab(state.currentTab));
closeModalBtn.addEventListener("click", () => {
  entryModal.classList.add("hidden");
  entryModal.classList.remove("flex");
});

universalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(universalForm);
  const payload = Object.fromEntries(formData.entries());
  payload.createdAt = serverTimestamp();

  await addDoc(collection(db, state.currentTab), payload);
  universalForm.reset();
  entryModal.classList.add("hidden");
  entryModal.classList.remove("flex");
});

window.deleteEntity = async (col, id) => {
  if (confirm("Are you sure you want to delete this?")) {
    await deleteDoc(doc(db, col, id));
  }
};

// ================= 7. RENDER VIEW ENGINE =================
const container = document.getElementById("tabContentContainer");
const sectionTitle = document.getElementById("currentSectionTitle");
const newEntryBtnLabel = document.getElementById("newEntryBtnLabel");
const recordCountLabel = document.getElementById("recordCountLabel");

const titleMap = {
  clients: "Clients List",
  projects: "Projects",
  tasks: "Tasks",
  recurring: "Recurring Clients",
  payments: "Payment History",
  social: "Social Media Posts",
  team: "Team Members",
  reports: "Business Summary"
};

const buttonLabelMap = {
  clients: "Add Client",
  projects: "Add Project",
  tasks: "Add Task",
  recurring: "Add Client",
  payments: "Add Payment",
  social: "Add Post",
  team: "Add Member"
};

function renderActiveTab() {
  const tab = state.currentTab;
  sectionTitle.textContent = titleMap[tab] || "Details";
  newEntryBtnLabel.textContent = buttonLabelMap[tab] || "Add New";

  let list = state.data[tab] || [];

  if (state.searchQuery.trim()) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(item => 
      Object.values(item).some(val => String(val).toLowerCase().includes(q))
    );
  }

  recordCountLabel.textContent = `${list.length} Items`;

  if (tab === "reports") {
    renderReportsView();
    return;
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="py-16 text-center text-slate-400 text-sm">
        <i data-lucide="inbox" class="w-8 h-8 mx-auto mb-2 text-slate-300"></i>
        No records found.
      </div>
    `;
    lucide.createIcons();
    return;
  }

  const headers = schemas[tab].map(s => s.label);
  let tableHtml = `
    <table class="w-full text-left text-sm text-slate-700">
      <thead class="bg-slate-50 text-xs font-semibold text-slate-500 border-b border-slate-200">
        <tr>
          ${headers.map(h => `<th class="px-5 py-3.5 font-bold">${h}</th>`).join("")}
          <th class="px-5 py-3.5 font-bold text-right">Action</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 font-normal">
  `;

  list.forEach(row => {
    tableHtml += `<tr class="hover:bg-krypton-tint/40 transition">`;
    schemas[tab].forEach(field => {
      let val = row[field.name] || "-";
      
      if (field.name === "budget" || field.name === "amount" || field.name === "monthlyFee") {
        val = `<span class="font-mono font-bold text-slate-900 bg-krypton-tint border border-krypton-border px-2 py-0.5 rounded-lg">₹${Number(val).toLocaleString()}</span>`;
      } 
      else if (field.name === "status" || field.name === "subscriptionStatus" || field.name === "priority") {
        let badgeColor = "bg-slate-100 text-slate-700 border-slate-200";
        if (val === "Active" || val === "Completed" || val === "Done" || val === "Posted") {
          badgeColor = "bg-krypton-tint text-slate-950 font-bold border-krypton-border shadow-[0_0_8px_rgba(0,255,102,0.25)]";
        } else if (val === "In Progress" || val === "High" || val === "Urgent") {
          badgeColor = "bg-amber-50 text-amber-800 border-amber-200 font-semibold";
        } else if (val === "Cancelled" || val === "On Leave") {
          badgeColor = "bg-rose-50 text-rose-700 border-rose-200 font-semibold";
        }
        val = `<span class="px-2.5 py-0.5 rounded-full text-xs border ${badgeColor}">${val}</span>`;
      }
      tableHtml += `<td class="px-5 py-3.5 text-slate-800">${val}</td>`;
    });
    tableHtml += `
      <td class="px-5 py-3.5 text-right">
        <button onclick="deleteEntity('${tab}', '${row.id}')" class="text-rose-600 hover:text-rose-800 text-xs font-semibold p-1 hover:bg-rose-50 rounded-lg transition">Delete</button>
      </td>
    </tr>`;
  });

  tableHtml += `</tbody></table>`;
  container.innerHTML = tableHtml;
  lucide.createIcons();
}

// ================= 8. REPORTS VIEW =================
function renderReportsView() {
  const rev = state.data.payments.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
  const totalPipeline = state.data.projects.reduce((acc, p) => acc + (Number(p.budget) || 0), 0);
  const activeMRR = state.data.recurring
    .filter(r => r.subscriptionStatus === "Active")
    .reduce((acc, curr) => acc + (Number(curr.monthlyFee) || 0), 0);

  container.innerHTML = `
    <div class="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-krypton-tint border-2 border-krypton-neon p-6 rounded-2xl krypton-card-glow">
        <span class="text-xs font-extrabold text-krypton-dark uppercase tracking-wider">Monthly Recurring Income</span>
        <h4 class="text-3xl font-black text-slate-950 mt-2 font-mono">₹${activeMRR.toLocaleString()}/mo</h4>
        <p class="text-xs text-slate-600 mt-1 font-medium">Guaranteed monthly income</p>
      </div>
      <div class="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Received Payments</span>
        <h4 class="text-3xl font-black text-slate-900 mt-2 font-mono">₹${rev.toLocaleString()}</h4>
        <p class="text-xs text-slate-500 mt-1 font-medium">Collected balance</p>
      </div>
      <div class="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
        <span class="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Project Value</span>
        <h4 class="text-3xl font-black text-slate-900 mt-2 font-mono">₹${totalPipeline.toLocaleString()}</h4>
        <p class="text-xs text-slate-500 mt-1 font-medium">Total pipeline value</p>
      </div>
    </div>
  `;
}

// ================= 9. TAB SWITCHING =================
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.className = "tab-btn w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition";
    });
    btn.className = "tab-btn w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-bold bg-krypton-neon text-slate-950 krypton-glow transition";
    
    state.currentTab = btn.getAttribute("data-tab");
    openModalBtn.style.display = state.currentTab === "reports" ? "none" : "flex";
    renderActiveTab();
  });
});

document.getElementById("globalSearch").addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  renderActiveTab();
});

document.getElementById("refreshBtn").addEventListener("click", () => {
  const icon = document.getElementById("refreshIcon");
  icon.classList.add("animate-spin");
  initLiveSubscriptions();
  setTimeout(() => icon.classList.remove("animate-spin"), 600);
});

// Load icons
lucide.createIcons();
