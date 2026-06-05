import { storage } from './storage.js';

// 分类配置
const CATEGORY_EMOJI = {
  '餐饮': '🍜', '交通': '🚗', '购物': '🛍️', '住房': '🏠',
  '娱乐': '🎮', '医疗': '🏥', '教育': '📚', '通讯': '📱',
  '服饰': '👔', '日用': '🧴', '其他': '💰',
  '工资': '💼', '奖金': '🎁', '投资': '📈', '兼职': '💻', '红包': '🧧'
};

const DEFAULT_CATEGORIES = {
  expense: ['餐饮', '交通', '购物', '住房', '娱乐', '医疗', '教育', '通讯', '服饰', '日用', '其他'],
  income: ['工资', '奖金', '投资', '兼职', '红包', '其他']
};

const CHART_COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
  '#FF9F40', '#C9CBCF', '#7BC8A4', '#E7E9ED', '#F7464A',
  '#46BFBD', '#FDB45C'
];

// 工具函数
function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function formatMoney(n) {
  return (n < 0 ? '-' : '') + '¥' + Math.abs(n).toFixed(2);
}

function formatDate(d) {
  return d.replace(/-/g, '/');
}

function getMonthStr(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function shiftMonth(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return getMonthStr(d);
}

function monthDisplay(monthStr) {
  const [y, m] = monthStr.split('-');
  return `${y}年${parseInt(m)}月`;
}

function dayOfWeek(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[new Date(dateStr).getDay()];
}

// Toast 提示
function toast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), duration);
}

// App 类
class App {
  constructor() {
    this.data = null;
    this.currentPage = 'dashboard';
    this.currentMonth = getMonthStr(new Date());
    this.billsMonth = getMonthStr(new Date());
    this.statsMonth = getMonthStr(new Date());
    this.editingId = null;
    this.selectedCategory = '';
    this.addType = 'expense';
    this.editType = 'expense';
    this.charts = {};
    this.syncTimer = null;
  }

  async init() {
    this.bindEvents();
    this.setTodayDate();

    const token = storage.getToken();
    if (token) {
      await this.loadData();
    } else {
      this.data = this.defaultData();
      this.navigate('settings');
      toast('请先配置 GitHub Token');
    }
    this.render();
  }

  defaultData() {
    return {
      transactions: [],
      categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)),
      settings: { currency: '¥' }
    };
  }

  async loadData() {
    this.setSyncStatus('syncing');
    let loaded = await storage.loadData();
    if (!loaded) {
      loaded = this.defaultData();
      await storage.saveData(loaded);
    }
    if (!loaded.categories) loaded.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    if (!loaded.settings) loaded.settings = { currency: '¥' };
    this.data = loaded;
    this.setSyncStatus('online');
  }

  async syncToCloud() {
    if (!storage.getToken()) return;
    this.setSyncStatus('syncing');
    const ok = await storage.saveData(this.data);
    this.setSyncStatus(ok ? 'online' : 'offline');
  }

  async manualSync() {
    if (!storage.getToken()) {
      toast('请先配置 GitHub Token');
      return;
    }
    toast('正在同步...');
    await this.syncToCloud();
    toast('同步完成');
  }

  scheduleSync() {
    clearTimeout(this.syncTimer);
    this.syncTimer = setTimeout(() => this.syncToCloud(), 1500);
  }

  setSyncStatus(status) {
    const dot = document.getElementById('sync-status');
    dot.className = 'sync-dot ' + status;
    dot.title = status === 'online' ? '已连接' : status === 'syncing' ? '同步中...' : '未连接';
  }

  setTodayDate() {
    document.getElementById('add-date').value = todayStr();
  }

  // 导航
  navigate(page) {
    this.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');

    const titles = { dashboard: '记账本', add: '记一笔', bills: '账单', stats: '统计', settings: '设置' };
    document.getElementById('header-title').textContent = titles[page] || '记账本';
    this.render();
  }

  render() {
    switch (this.currentPage) {
      case 'dashboard': this.renderDashboard(); break;
      case 'add': this.renderAddCategories(); break;
      case 'bills': this.renderBills(); break;
      case 'stats': this.renderStats(); break;
      case 'settings': this.renderSettings(); break;
    }
  }

  // 仪表盘
  renderDashboard() {
    const month = this.currentMonth;
    document.getElementById('dashboard-month').textContent = monthDisplay(month);

    const txs = this.getMonthTransactions(month);
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    document.getElementById('summary-income').textContent = formatMoney(income);
    document.getElementById('summary-expense').textContent = formatMoney(expense);
    document.getElementById('summary-balance').textContent = formatMoney(income - expense);

    // 计算总收支
    const allTxs = this.data.transactions || [];
    const totalIncome = allTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = allTxs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const totalBalance = totalIncome - totalExpense;
    document.getElementById('total-income').textContent = formatMoney(totalIncome);
    document.getElementById('total-expense').textContent = formatMoney(totalExpense);
    const balanceEl = document.getElementById('total-balance');
    balanceEl.textContent = formatMoney(totalBalance);
    balanceEl.className = 'total-value ' + (totalBalance >= 0 ? 'income' : 'expense');

    const list = document.getElementById('recent-transactions');
    const empty = document.getElementById('dashboard-empty');

    if (txs.length === 0) {
      list.style.display = 'none';
      empty.style.display = 'block';
    } else {
      list.style.display = 'block';
      empty.style.display = 'none';
      const recent = txs.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 20);
      list.innerHTML = recent.map(tx => this.renderTransactionItem(tx)).join('');
    }
  }

  renderTransactionItem(tx) {
    const emoji = CATEGORY_EMOJI[tx.category] || '💰';
    return `
      <div class="transaction-item" data-id="${tx.id}">
        <div class="tx-icon ${tx.type}">${emoji}</div>
        <div class="tx-info">
          <div class="tx-category">${tx.category}</div>
          ${tx.note ? `<div class="tx-note">${this.escapeHtml(tx.note)}</div>` : ''}
        </div>
        <div class="tx-amount ${tx.type}">${tx.type === 'expense' ? '-' : '+'}${formatMoney(tx.amount)}</div>
      </div>`;
  }

  escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  getMonthTransactions(month) {
    return (this.data.transactions || []).filter(t => t.date.startsWith(month));
  }

  // 添加页面
  renderAddCategories() {
    const cats = this.data.categories[this.addType] || [];
    const grid = document.getElementById('add-categories');
    grid.innerHTML = cats.map(c => `
      <div class="category-item${this.selectedCategory === c ? ' selected' : ''}" data-cat="${c}">
        <span class="category-emoji">${CATEGORY_EMOJI[c] || '💰'}</span>
        <span class="category-name">${c}</span>
      </div>`).join('');
    if (!this.selectedCategory && cats.length) {
      this.selectedCategory = cats[0];
      grid.firstChild.classList.add('selected');
    }
  }

  // 账单页面
  renderBills() {
    const month = this.billsMonth;
    document.getElementById('bills-month').textContent = monthDisplay(month);

    const txs = this.getMonthTransactions(month);

    // 月度汇总
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    document.getElementById('bills-summary').innerHTML = `
      <div class="summary-card income">
        <span class="summary-label">收入</span>
        <span class="summary-value">${formatMoney(income)}</span>
      </div>
      <div class="summary-card expense">
        <span class="summary-label">支出</span>
        <span class="summary-value">${formatMoney(expense)}</span>
      </div>
      <div class="summary-card balance">
        <span class="summary-label">结余</span>
        <span class="summary-value">${formatMoney(income - expense)}</span>
      </div>`;

    txs.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

    const list = document.getElementById('bills-list');
    const empty = document.getElementById('bills-empty');

    if (txs.length === 0) {
      list.style.display = 'none';
      empty.style.display = 'block';
    } else {
      list.style.display = 'block';
      empty.style.display = 'none';

      const groups = {};
      txs.forEach(tx => {
        if (!groups[tx.date]) groups[tx.date] = [];
        groups[tx.date].push(tx);
      });

      let html = '';
      for (const [date, items] of Object.entries(groups)) {
        const dayIncome = items.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const dayExpense = items.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const summary = [];
        if (dayIncome) summary.push(`收 ${formatMoney(dayIncome)}`);
        if (dayExpense) summary.push(`支 ${formatMoney(dayExpense)}`);

        html += `<div class="date-group-header">
          <span>${formatDate(date)} ${dayOfWeek(date)}</span>
          <span>${summary.join(' ')}</span>
        </div>`;
        html += items.map(tx => this.renderTransactionItem(tx)).join('');
      }
      list.innerHTML = html;
    }
  }

  // 统计页面
  renderStats() {
    const month = this.statsMonth;
    document.getElementById('stats-month').textContent = monthDisplay(month);

    // 数字摘要
    const txs = this.getMonthTransactions(month);
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    document.getElementById('stats-summary').innerHTML = `
      <div class="summary-card income">
        <span class="summary-label">收入</span>
        <span class="summary-value">${formatMoney(income)}</span>
      </div>
      <div class="summary-card expense">
        <span class="summary-label">支出</span>
        <span class="summary-value">${formatMoney(expense)}</span>
      </div>
      <div class="summary-card balance">
        <span class="summary-label">结余</span>
        <span class="summary-value">${formatMoney(income - expense)}</span>
      </div>`;

    this.renderCategoryChart(month);
    this.renderTrendChart(month);
  }

  renderCategoryChart(month) {
    const txs = this.getMonthTransactions(month).filter(t => t.type === 'expense');
    const container = document.getElementById('chart-category-empty');
    const canvas = document.getElementById('chart-category');

    if (this.charts.category) {
      this.charts.category.destroy();
      this.charts.category = null;
    }

    if (txs.length === 0) {
      container.style.display = 'block';
      canvas.style.display = 'none';
      return;
    }
    container.style.display = 'none';
    canvas.style.display = 'block';

    const catMap = {};
    txs.forEach(t => {
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
    });
    const labels = Object.keys(catMap);
    const values = Object.values(catMap);

    this.charts.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: CHART_COLORS.slice(0, labels.length)
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } }
        }
      }
    });
  }

  renderTrendChart(month) {
    if (this.charts.trend) {
      this.charts.trend.destroy();
      this.charts.trend = null;
    }

    const canvas = document.getElementById('chart-trend');
    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push(shiftMonth(month, -i));
    }

    const incomeData = [];
    const expenseData = [];
    months.forEach(m => {
      const txs = this.getMonthTransactions(m);
      incomeData.push(txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0));
      expenseData.push(txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0));
    });

    this.charts.trend = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months.map(m => m.slice(5) + '月'),
        datasets: [
          {
            label: '收入',
            data: incomeData,
            backgroundColor: 'rgba(76,175,80,0.6)',
            borderRadius: 4
          },
          {
            label: '支出',
            data: expenseData,
            backgroundColor: 'rgba(244,67,54,0.6)',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 12 } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { font: { size: 11 } } },
          x: { ticks: { font: { size: 11 } } }
        }
      }
    });
  }

  // 设置页面
  renderSettings() {
    const token = storage.getToken();
    document.getElementById('set-token').value = token || '';
    document.getElementById('gist-id-display').textContent = storage.getGistId() || '未设置';

    const status = document.getElementById('connect-status');
    if (storage.isConnected()) {
      status.textContent = '已连接';
      status.className = 'success';
    } else if (token) {
      status.textContent = 'Token 已保存，正在连接...';
      status.className = '';
    } else {
      status.textContent = '';
      status.className = '';
    }
  }

  // 保存交易
  saveTransaction() {
    const amount = parseFloat(document.getElementById('add-amount').value);
    if (!amount || amount <= 0) {
      toast('请输入金额');
      return;
    }
    if (!this.selectedCategory) {
      toast('请选择分类');
      return;
    }

    const tx = {
      id: uuid(),
      type: this.addType,
      amount: Math.round(amount * 100) / 100,
      category: this.selectedCategory,
      note: document.getElementById('add-note').value.trim(),
      date: document.getElementById('add-date').value || todayStr()
    };

    this.data.transactions.push(tx);
    this.scheduleSync();

    // 重置表单
    document.getElementById('add-amount').value = '';
    document.getElementById('add-note').value = '';
    this.setTodayDate();

    toast('已保存');
    this.navigate('dashboard');
  }

  // 编辑交易
  openEditModal(id) {
    const tx = this.data.transactions.find(t => t.id === id);
    if (!tx) return;
    this.editingId = id;
    this.editType = tx.type;

    document.getElementById('edit-amount').value = tx.amount;
    document.getElementById('edit-date').value = tx.date;
    document.getElementById('edit-note').value = tx.note || '';

    document.getElementById('edit-type-expense').classList.toggle('active', tx.type === 'expense');
    document.getElementById('edit-type-income').classList.toggle('active', tx.type === 'income');

    this.renderEditCategories();
    this.selectEditCategory(tx.category);

    document.getElementById('modal-edit').style.display = 'flex';
  }

  renderEditCategories() {
    const cats = this.data.categories[this.editType] || [];
    const grid = document.getElementById('edit-categories');
    grid.innerHTML = cats.map(c => `
      <div class="category-item" data-cat="${c}">
        <span class="category-emoji">${CATEGORY_EMOJI[c] || '💰'}</span>
        <span class="category-name">${c}</span>
      </div>`).join('');
  }

  selectEditCategory(cat) {
    document.querySelectorAll('#edit-categories .category-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.cat === cat);
    });
  }

  saveEdit() {
    const tx = this.data.transactions.find(t => t.id === this.editingId);
    if (!tx) return;

    const amount = parseFloat(document.getElementById('edit-amount').value);
    if (!amount || amount <= 0) {
      toast('请输入金额');
      return;
    }

    const selectedCat = document.querySelector('#edit-categories .category-item.selected');
    if (!selectedCat) {
      toast('请选择分类');
      return;
    }

    tx.type = this.editType;
    tx.amount = Math.round(amount * 100) / 100;
    tx.category = selectedCat.dataset.cat;
    tx.date = document.getElementById('edit-date').value || todayStr();
    tx.note = document.getElementById('edit-note').value.trim();

    this.closeModal();
    this.scheduleSync();
    this.render();
    toast('已更新');
  }

  deleteTransaction() {
    if (!this.editingId) return;
    this.data.transactions = this.data.transactions.filter(t => t.id !== this.editingId);
    this.closeModal();
    this.scheduleSync();
    this.render();
    toast('已删除');
  }

  closeModal() {
    document.getElementById('modal-edit').style.display = 'none';
    this.editingId = null;
  }

  // 导出数据
  exportData() {
    const blob = new Blob([JSON.stringify(this.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `记账本_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('已导出');
  }

  // 导入数据
  importData(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported.transactions) throw new Error('格式错误');
        this.data = imported;
        if (!this.data.categories) this.data.categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
        if (!this.data.settings) this.data.settings = { currency: '¥' };
        await this.syncToCloud();
        this.render();
        toast('导入成功');
      } catch (err) {
        toast('导入失败: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // 连接 GitHub
  async connect() {
    const token = document.getElementById('set-token').value.trim();
    if (!token) {
      toast('请输入 Token');
      return;
    }

    const status = document.getElementById('connect-status');
    status.textContent = '连接中...';
    status.className = '';

    const result = await storage.testConnection(token);
    if (!result.ok) {
      status.textContent = '连接失败: ' + result.error;
      status.className = 'error';
      return;
    }

    storage.setToken(token);

    // 尝试找到已有的 Gist
    const existingId = await storage.findExistingGist(token);
    if (existingId) {
      storage.setGistId(existingId);
    }

    await this.loadData();
    this.render();
    toast('连接成功');
  }

  // 事件绑定
  bindEvents() {
    // 底部导航
    document.getElementById('bottom-nav').addEventListener('click', (e) => {
      const item = e.target.closest('.nav-item');
      if (item) this.navigate(item.dataset.page);
    });

    // 月份切换
    document.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (!action) return;

      switch (action) {
        case 'prev-month':
          this.currentMonth = shiftMonth(this.currentMonth, -1);
          this.renderDashboard();
          break;
        case 'next-month':
          this.currentMonth = shiftMonth(this.currentMonth, 1);
          this.renderDashboard();
          break;
        case 'bills-prev-month':
          this.billsMonth = shiftMonth(this.billsMonth, -1);
          this.renderBills();
          break;
        case 'bills-next-month':
          this.billsMonth = shiftMonth(this.billsMonth, 1);
          this.renderBills();
          break;
        case 'stats-prev-month':
          this.statsMonth = shiftMonth(this.statsMonth, -1);
          this.renderStats();
          break;
        case 'stats-next-month':
          this.statsMonth = shiftMonth(this.statsMonth, 1);
          this.renderStats();
          break;
        case 'save':
          this.saveTransaction();
          break;
        case 'connect':
          this.connect();
          break;
        case 'export':
          this.exportData();
          break;
        case 'import':
          document.getElementById('import-file').click();
          break;
        case 'sync':
          this.manualSync();
          break;
        case 'modal-cancel':
          this.closeModal();
          break;
        case 'modal-save':
          this.saveEdit();
          break;
        case 'modal-delete':
          this.deleteTransaction();
          break;
      }
    });

    // 类型切换 - 添加页
    document.querySelectorAll('#page-add .type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#page-add .type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.addType = btn.dataset.type;
        this.selectedCategory = '';
        this.renderAddCategories();
      });
    });

    // 类型切换 - 编辑弹窗
    document.querySelectorAll('#modal-edit .type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#modal-edit .type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.editType = btn.dataset.type;
        this.renderEditCategories();
      });
    });

    // 分类选择 - 添加页
    document.getElementById('add-categories').addEventListener('click', (e) => {
      const item = e.target.closest('.category-item');
      if (!item) return;
      document.querySelectorAll('#add-categories .category-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      this.selectedCategory = item.dataset.cat;
    });

    // 分类选择 - 编辑弹窗
    document.getElementById('edit-categories').addEventListener('click', (e) => {
      const item = e.target.closest('.category-item');
      if (!item) return;
      document.querySelectorAll('#edit-categories .category-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
    });

    // 交易项点击
    document.getElementById('recent-transactions').addEventListener('click', (e) => {
      const item = e.target.closest('.transaction-item');
      if (item) this.openEditModal(item.dataset.id);
    });

    document.getElementById('bills-list').addEventListener('click', (e) => {
      const item = e.target.closest('.transaction-item');
      if (item) this.openEditModal(item.dataset.id);
    });

    // 导入文件
    document.getElementById('import-file').addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this.importData(e.target.files[0]);
        e.target.value = '';
      }
    });

    // 弹窗背景点击关闭
    document.getElementById('modal-edit').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.closeModal();
    });
  }
}

// 启动
const app = new App();
app.init();
