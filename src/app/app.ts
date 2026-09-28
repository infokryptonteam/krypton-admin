import { Component, OnInit } from '@angular/core';
import { FormControl, FormRecord, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { KryptonApiService } from './krypton-api.service';

type DataRow = Record<string, unknown>;
type PageId = 'dashboard' | 'clients' | 'projects' | 'files' | 'urls' | 'tasks' | 'team' | 'payments' | 'reports' | 'settings';
type DataKey = Exclude<PageId, 'dashboard' | 'settings'>;

interface WorkspaceData {
  clients: DataRow[];
  projects: DataRow[];
  files: DataRow[];
  urls: DataRow[];
  tasks: DataRow[];
  team: DataRow[];
  payments: DataRow[];
  reports: DataRow[];
  settings: DataRow[];
}

interface TableColumn {
  key: string;
  label: string;
  link?: boolean;
}

interface SelectOption {
  value: string;
  label: string;
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'number' | 'date' | 'month' | 'url' | 'select' | 'textarea';
  required?: boolean;
  full?: boolean;
  placeholder?: string;
  initialValue?: string;
  options?: SelectOption[];
}

const emptyWorkspace = (): WorkspaceData => ({
  clients: [], projects: [], files: [], urls: [], tasks: [], team: [], payments: [], reports: [], settings: [],
});

const pageDefinitions: Array<{ id: PageId; label: string; dataKey?: DataKey; addLabel?: string; columns?: TableColumn[] }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Clients', dataKey: 'clients', addLabel: 'Add Client', columns: [
    { key: 'Client Name', label: 'Client' }, { key: 'Contact Person', label: 'Contact' }, { key: 'Phone', label: 'Phone' }, { key: 'Services', label: 'Services' }, { key: 'Status', label: 'Status' },
  ] },
  { id: 'projects', label: 'Projects', dataKey: 'projects', addLabel: 'Add Project', columns: [
    { key: 'Project Name', label: 'Project' }, { key: 'Client ID', label: 'Client ID' }, { key: 'Assigned To', label: 'Assigned To' }, { key: 'Deadline', label: 'Deadline' }, { key: 'Status', label: 'Status' },
  ] },
  { id: 'files', label: 'Files', dataKey: 'files', addLabel: 'Add File', columns: [
    { key: 'File Name', label: 'File' }, { key: 'Client ID', label: 'Client' }, { key: 'Project ID', label: 'Project' }, { key: 'File Type', label: 'Type' }, { key: 'File Link', label: 'Link', link: true },
  ] },
  { id: 'urls', label: 'Project URLs', dataKey: 'urls', addLabel: 'Add URL', columns: [
    { key: 'URL Name', label: 'Name' }, { key: 'Client ID', label: 'Client' }, { key: 'Project ID', label: 'Project' }, { key: 'Type', label: 'Type' }, { key: 'URL', label: 'Link', link: true },
  ] },
  { id: 'tasks', label: 'Tasks', dataKey: 'tasks', addLabel: 'Add Task', columns: [
    { key: 'Task', label: 'Task' }, { key: 'Project ID', label: 'Project' }, { key: 'Assigned To', label: 'Assigned To' }, { key: 'Priority', label: 'Priority' }, { key: 'Status', label: 'Status' }, { key: 'Deadline', label: 'Deadline' },
  ] },
  { id: 'team', label: 'Team', dataKey: 'team', addLabel: 'Add Member', columns: [
    { key: 'Name', label: 'Name' }, { key: 'Role', label: 'Role' }, { key: 'Phone', label: 'Phone' }, { key: 'Email', label: 'Email' }, { key: 'Status', label: 'Status' },
  ] },
  { id: 'payments', label: 'Payments', dataKey: 'payments', addLabel: 'Add Payment', columns: [
    { key: 'Client ID', label: 'Client' }, { key: 'Project ID', label: 'Project' }, { key: 'Amount', label: 'Amount' }, { key: 'Due Date', label: 'Due Date' }, { key: 'Status', label: 'Status' },
  ] },
  { id: 'reports', label: 'Reports', dataKey: 'reports', addLabel: 'Add Report', columns: [
    { key: 'Client ID', label: 'Client' }, { key: 'Month', label: 'Month' }, { key: 'Summary', label: 'Summary' }, { key: 'Report URL', label: 'Report', link: true },
  ] },
  { id: 'settings', label: 'Settings' },
];

@Component({
  imports: [FormsModule, ReactiveFormsModule],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app-shell.html',
})
export class App implements OnInit {
  readonly pages = pageDefinitions;
  readonly loginForm = new FormRecord<FormControl<string>>({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  entryForm = new FormRecord<FormControl<string>>({});
  data = emptyWorkspace();
  activePage: PageId = 'dashboard';
  searchQuery = '';
  statusFilter = '';
  loginError = '';
  appError = '';
  notice = '';
  userEmail = '';
  modalTitle = '';
  modalError = '';
  modalPage: DataKey | null = null;
  modalFields: FormField[] = [];
  passwordVisible = false;
  loginBusy = false;
  dataLoading = false;
  saving = false;
  backupBusy = false;
  sidebarOpen = false;
  authenticated = false;
  private loginAttempts = 0;
  private loginLockUntil = 0;
  private noticeTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly api: KryptonApiService) {}

  ngOnInit(): void {
    this.api.call<{ authenticated: boolean; email?: string }>('getSession').subscribe({
      next: session => {
        this.authenticated = session.authenticated;
        this.userEmail = session.email || '';
        if (this.authenticated) this.loadData();
      },
      error: () => this.authenticated = false,
    });
  }

  get currentPage(): (typeof pageDefinitions)[number] {
    return this.pages.find(page => page.id === this.activePage) ?? this.pages[0];
  }

  get currentRows(): DataRow[] {
    const key = this.currentPage.dataKey;
    return key ? this.data[key] : [];
  }

  get filteredRows(): DataRow[] {
    const query = this.searchQuery.trim().toLocaleLowerCase();
    const status = this.statusFilter.trim().toLocaleLowerCase();
    return this.currentRows.filter(row => {
      const matchesQuery = !query || Object.values(row).some(value => this.stringify(value).toLocaleLowerCase().includes(query));
      const matchesStatus = !status || this.stringify(row['Status']).toLocaleLowerCase() === status;
      return matchesQuery && matchesStatus;
    });
  }

  get statusOptions(): string[] {
    return [...new Set(this.currentRows.map(row => this.stringify(row['Status']).trim()).filter(Boolean))];
  }

  get dashboardStats(): Array<{ label: string; value: string | number }> {
    const activeProjects = this.data.projects.filter(project => !['completed', 'closed'].includes(this.stringify(project['Status']).toLowerCase())).length;
    const revenue = this.data.payments.reduce((sum, payment) => ['paid', 'received', 'completed', 'complete'].includes(this.stringify(payment['Status']).trim().toLowerCase()) ? sum + (Number(payment['Amount']) || 0) : sum, 0);
    const pending = this.data.payments.reduce((sum, payment) => ['pending', 'unpaid', 'due', 'partial'].includes(this.stringify(payment['Status']).trim().toLowerCase()) ? sum + (Number(payment['Amount']) || 0) : sum, 0);
    return [
      { label: 'Total Clients', value: this.data.clients.length },
      { label: 'Active Projects', value: activeProjects },
      { label: 'Total Revenue', value: `₹${revenue.toLocaleString('en-IN')}` },
      { label: 'Files Managed', value: this.data.files.length },
      { label: 'Pending Payments', value: `₹${pending.toLocaleString('en-IN')}` },
    ];
  }

  get exportRows(): DataRow[] {
    if (this.activePage === 'dashboard') return this.dashboardStats.map(stat => ({ Metric: stat.label, Value: stat.value }));
    return this.filteredRows;
  }

  get recentProjects(): DataRow[] { return [...this.data.projects].reverse().slice(0, 5); }
  get recentPayments(): DataRow[] { return [...this.data.payments].reverse().slice(0, 5); }
  get recentClients(): DataRow[] { return [...this.data.clients].reverse().slice(0, 6); }

  submitLogin(): void {
    this.loginError = '';
    if (this.loginBusy) return;
    const remaining = this.loginLockUntil - Date.now();
    if (remaining > 0) {
      this.loginError = `Too many failed attempts. Try again in ${Math.ceil(remaining / 1000)} seconds.`;
      return;
    }
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError = this.loginForm.controls['email'].invalid ? 'Please enter a valid email address.' : 'Please enter email and password.';
      return;
    }
    this.loginBusy = true;
    const email = this.loginForm.controls['email'].value.trim();
    const password = this.loginForm.controls['password'].value;
    this.api.call<{ success?: boolean; message?: string; token?: string; email?: string }>('loginUser', { email, password }).subscribe({
      next: response => {
        this.loginBusy = false;
        if (!response?.success) {
          this.handleFailedLogin(response?.message || 'Invalid email or password.');
          return;
        }
        this.loginAttempts = 0;
        this.authenticated = true;
        this.userEmail = response.email || email;
        this.loginForm.controls['password'].reset('');
        this.loadData();
      },
      error: error => {
        this.loginBusy = false;
        this.loginError = 'Unable to sign in right now. Please try again.';
        console.error('KRYPTON login error:', error);
      },
    });
  }

  private handleFailedLogin(message: string): void {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.loginLockUntil = Date.now() + 30_000;
      this.loginAttempts = 0;
      this.loginError = 'Too many failed attempts. Login is temporarily locked for 30 seconds.';
    } else {
      this.loginError = message;
    }
  }

  togglePassword(): void { this.passwordVisible = !this.passwordVisible; }

  logout(): void {
    this.authenticated = false;
    this.data = emptyWorkspace();
    this.userEmail = '';
    this.api.call('logoutUser').subscribe({ error: () => undefined });
  }

  showPage(page: PageId): void {
    this.activePage = page;
    this.searchQuery = '';
    this.statusFilter = '';
    this.sidebarOpen = false;
    this.appError = '';
  }

  toggleSidebar(): void { this.sidebarOpen = !this.sidebarOpen; }
  refreshData(): void { this.loadData(); }

  openAddModal(page: DataKey = this.activePage as DataKey): void {
    if (!['clients', 'projects', 'files', 'urls', 'tasks', 'team', 'payments', 'reports'].includes(page)) return;
    this.modalPage = page;
    this.modalTitle = this.pages.find(item => item.id === page)?.addLabel || 'Add Record';
    this.modalError = '';
    this.modalFields = this.fieldsFor(page);
    this.entryForm = new FormRecord<FormControl<string>>({});
    for (const field of this.modalFields) {
      const validators = field.required ? [Validators.required] : [];
      if (field.required && field.type !== 'select') validators.push(Validators.pattern(/\S/));
      if (field.type === 'email') validators.push(Validators.email);
      if (field.type === 'url') validators.push(Validators.pattern(/^https?:\/\/.+\..+/i));
      if (field.type === 'number') validators.push(Validators.min(field.key === 'Amount' ? 0.01 : 0));
      this.entryForm.addControl(field.key, new FormControl(field.initialValue || '', { nonNullable: true, validators }));
    }
  }

  closeModal(): void { this.modalPage = null; this.modalError = ''; this.saving = false; }

  onClientChanged(): void { this.entryForm.controls['Project ID']?.setValue(''); }

  optionsFor(field: FormField): SelectOption[] {
    if (field.key === 'Client ID') {
      return this.data.clients.map(client => ({ value: this.stringify(client['Client ID']), label: this.stringify(client['Client Name'] || client['Client ID']) }));
    }
    if (field.key === 'Project ID') {
      const clientId = this.entryForm.controls['Client ID']?.value || '';
      return this.data.projects.filter(project => !clientId || this.stringify(project['Client ID']) === clientId)
        .map(project => ({ value: this.stringify(project['Project ID']), label: this.stringify(project['Project Name'] || project['Project ID']) }));
    }
    return field.options || [];
  }

  saveRecord(): void {
    if (!this.modalPage || this.saving) return;
    if (this.entryForm.invalid) {
      this.entryForm.markAllAsTouched();
      this.modalError = 'Please complete the required fields highlighted below.';
      return;
    }
    const page = this.modalPage;
    const data: DataRow = Object.fromEntries(Object.entries(this.entryForm.getRawValue()).map(([key, value]) => [key, value.trim()]));
    if (page === 'tasks') data['Task ID'] = `TSK-${Date.now()}`;
    if (page === 'team') data['Member ID'] = `MEM-${Date.now()}`;
    if (page === 'payments') data['Payment ID'] = `PAY-${Date.now()}`;
    if (page === 'reports') data['Report ID'] = `RPT-${Date.now()}`;

    let action = 'addRecord';
    let payload: Record<string, unknown> = { sheetName: this.sheetName(page), data };
    if (page === 'clients' || page === 'projects') {
      action = page === 'clients' ? 'addClient' : 'addProject';
      payload = { data };
    } else if (page === 'urls') {
      action = 'addProjectURL';
      payload = { clientId: data['Client ID'], projectId: data['Project ID'], name: data['URL Name'], url: data['URL'], type: data['Type'], notes: data['Notes'] };
    }
    this.saving = true;
    this.api.call(action, payload).subscribe({
      next: () => this.finishSave('Record saved successfully.'),
      error: error => this.saveFailed(error),
    });
  }

  private finishSave(message: string): void {
    this.closeModal();
    this.showNotice(message);
    this.loadData();
  }

  private saveFailed(error: unknown): void {
    this.saving = false;
    if (this.handleAuthFailure(error)) return;
    this.modalError = this.errorMessage(error, 'Could not save this record.');
  }

  createBackup(): void {
    if (this.backupBusy) return;
    this.backupBusy = true;
    this.api.call<{ createdAt: string; records: WorkspaceData }>('createKryptonBackup').subscribe({
      next: result => {
        this.backupBusy = false;
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `krypton-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showNotice('Workspace backup downloaded.');
      },
      error: error => {
        this.backupBusy = false;
        if (!this.handleAuthFailure(error)) this.appError = this.errorMessage(error, 'Backup failed.');
      },
    });
  }

  exportCsv(): void {
    const rows = this.exportRows;
    const columns = rows.length ? Object.keys(rows[0]) : (this.currentPage.columns || []).map(column => column.key);
    const csvValue = (value: unknown): string => {
      let text = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      if (/^[\t\r ]*[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const content = [columns.map(csvValue).join(','), ...rows.map(row => columns.map(column => csvValue(row[column])).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `krypton-${this.activePage}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  cellValue(row: DataRow, key: string): string { return this.stringify(row[key]); }
  hasCellValue(row: DataRow, key: string): boolean { return Boolean(row[key]); }
  clientName(clientId: unknown): string {
    const client = this.data.clients.find(item => this.stringify(item['Client ID']) === this.stringify(clientId));
    return client ? this.stringify(client['Client Name']) : this.stringify(clientId) || '-';
  }
  projectName(projectId: unknown): string {
    const project = this.data.projects.find(item => this.stringify(item['Project ID']) === this.stringify(projectId));
    return project ? this.stringify(project['Project Name']) : this.stringify(projectId) || '-';
  }
  formatAmount(amount: unknown): string { return (Number(amount) || 0).toLocaleString('en-IN'); }
  formControl(key: string): FormControl<string> { return this.entryForm.controls[key]; }
  stringify(value: unknown): string { return value === null || value === undefined || value === '' ? '-' : String(value); }

  private fieldsFor(page: DataKey): FormField[] {
    const choices = (values: string[]): SelectOption[] => values.map(value => ({ value, label: value }));
    const client = (): FormField => ({ key: 'Client ID', label: 'Client', type: 'select', required: true });
    const project = (required = true): FormField => ({ key: 'Project ID', label: 'Project', type: 'select', required });
    switch (page) {
      case 'clients': return [
        { key: 'Client Name', label: 'Client Name', type: 'text', required: true, placeholder: 'Client / Company name' },
        { key: 'Contact Person', label: 'Contact Person', type: 'text' }, { key: 'Phone', label: 'Phone', type: 'tel' },
        { key: 'Email', label: 'Email', type: 'email' }, { key: 'Services', label: 'Services', type: 'text', placeholder: 'Web, Design, Marketing...' },
        { key: 'Status', label: 'Status', type: 'select', initialValue: 'Active', options: choices(['Active', 'Inactive', 'Completed']) }, { key: 'Start Date', label: 'Start Date', type: 'date' },
        { key: 'Notes', label: 'Notes', type: 'textarea', full: true },
      ];
      case 'projects': return [
        client(), { key: 'Project Name', label: 'Project Name', type: 'text', required: true },
        { key: 'Description', label: 'Description', type: 'textarea', full: true }, { key: 'Assigned To', label: 'Assigned To', type: 'text' },
        { key: 'Priority', label: 'Priority', type: 'select', initialValue: 'Medium', options: choices(['Low', 'Medium', 'High']) }, { key: 'Status', label: 'Status', type: 'select', initialValue: 'Planning', options: choices(['Planning', 'In Progress', 'Completed', 'On Hold']) },
        { key: 'Budget', label: 'Budget', type: 'number' }, { key: 'Start Date', label: 'Start Date', type: 'date' },
        { key: 'Deadline', label: 'Deadline', type: 'date' }, { key: 'Notes', label: 'Notes', type: 'textarea', full: true },
      ];
      case 'files': return [
        { key: 'File Name', label: 'File Name', type: 'text', required: true },
        client(), project(), { key: 'File Type', label: 'File Type', type: 'text', placeholder: 'Document, image, spreadsheet...' },
        { key: 'File Link', label: 'File Link (optional)', type: 'url', full: true, placeholder: 'https://...' },
        { key: 'Notes', label: 'Notes', type: 'textarea', full: true },
      ];
      case 'urls': return [
        client(), project(), { key: 'URL Name', label: 'URL Name', type: 'text', required: true, placeholder: 'Live Website / Figma / Drive' },
        { key: 'Type', label: 'Type', type: 'text', placeholder: 'Website / Design / Drive' }, { key: 'URL', label: 'URL', type: 'url', required: true, full: true, placeholder: 'https://...' },
        { key: 'Notes', label: 'Notes', type: 'textarea', full: true },
      ];
      case 'tasks': return [
        client(), project(), { key: 'Task', label: 'Task', type: 'text', required: true, full: true }, { key: 'Assigned To', label: 'Assigned To', type: 'text' },
        { key: 'Priority', label: 'Priority', type: 'select', initialValue: 'Medium', options: choices(['Low', 'Medium', 'High']) }, { key: 'Status', label: 'Status', type: 'select', initialValue: 'Pending', options: choices(['Pending', 'In Progress', 'Completed']) },
        { key: 'Deadline', label: 'Deadline', type: 'date' },
      ];
      case 'team': return [
        { key: 'Name', label: 'Name', type: 'text', required: true }, { key: 'Role', label: 'Role', type: 'text' }, { key: 'Phone', label: 'Phone', type: 'tel' },
        { key: 'Email', label: 'Email', type: 'email' }, { key: 'Status', label: 'Status', type: 'select', initialValue: 'Active', options: choices(['Active', 'Inactive']) },
      ];
      case 'payments': return [
        client(), project(false), { key: 'Amount', label: 'Amount', type: 'number', required: true }, { key: 'Payment Date', label: 'Payment Date', type: 'date' },
        { key: 'Due Date', label: 'Due Date', type: 'date' }, { key: 'Status', label: 'Status', type: 'select', initialValue: 'Pending', options: choices(['Pending', 'Paid', 'Overdue']) },
        { key: 'Notes', label: 'Notes', type: 'textarea', full: true },
      ];
      case 'reports': return [
        client(), { key: 'Month', label: 'Month', type: 'month', required: true }, { key: 'Summary', label: 'Summary', type: 'textarea', full: true, placeholder: 'Monthly work, results, highlights...' },
        { key: 'Report URL', label: 'Report URL', type: 'url', full: true, placeholder: 'Google Drive / PDF / Canva / other link' },
      ];
    }
  }

  private sheetName(page: DataKey): string {
    return ({ clients: 'Clients', projects: 'Projects', files: 'Files', urls: 'URLs', tasks: 'Tasks', team: 'Team', payments: 'Payments', reports: 'Reports' })[page];
  }

  private loadData(): void {
    if (!this.authenticated) return;
    this.dataLoading = true;
    this.api.call<Partial<WorkspaceData>>('getAppData').subscribe({
      next: response => {
        this.data = { ...emptyWorkspace(), ...response };
        for (const key of Object.keys(this.data) as Array<keyof WorkspaceData>) {
          if (!Array.isArray(this.data[key])) this.data[key] = [];
        }
        this.dataLoading = false;
      },
      error: error => {
        this.dataLoading = false;
        if (!this.handleAuthFailure(error)) this.appError = this.errorMessage(error, 'Could not load dashboard data.');
      },
    });
  }

  private handleAuthFailure(error: unknown): boolean {
    const message = this.errorMessage(error, '');
    if (/unauthorized|not authenticated|session expired|invalid session/i.test(message)) {
      this.authenticated = false;
      this.data = emptyWorkspace();
      this.loginError = message;
      this.closeModal();
      return true;
    }
    return false;
  }

  private errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : typeof error === 'string' ? error : fallback;
  }

  private showNotice(message: string): void {
    this.notice = message;
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice = '', 4000);
  }
}
