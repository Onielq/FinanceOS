(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FinanceOSCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DATE_RE = /^\\d{4}-\\d{2}-\\d{2}$/;
  const TRANSFER_CATEGORIES = Object.freeze(['savings', 'investment', 'sacco', 'umworo', 'momo']);

  function localDateKey(value) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) throw new TypeError('Invalid date');
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function localMonthKey(value) {
    return localDateKey(value).slice(0, 7);
  }

  function parseDateKey(value) {
    if (typeof value !== 'string' || !DATE_RE.test(value)) throw new TypeError('Date must use YYYY-MM-DD');
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new TypeError('Invalid calendar date');
    }
    return { year, month, day, date };
  }

  function nextRecurringDate(dateKey, frequency, dayOfMonth) {
    const p = parseDateKey(dateKey);
    if (frequency === 'weekly' || frequency === 'biweekly') {
      p.date.setUTCDate(p.day + (frequency === 'weekly' ? 7 : 14));
      return p.date.toISOString().slice(0, 10);
    }
    if (frequency !== 'monthly') throw new TypeError('Unsupported recurring frequency');
    const monthStart = new Date(Date.UTC(p.year, p.month, 1));
    const lastDay = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    const targetDay = Math.min(Math.max(1, Number(dayOfMonth) || p.day), lastDay);
    return [monthStart.getUTCFullYear(), String(monthStart.getUTCMonth() + 1).padStart(2, '0'), String(targetDay).padStart(2, '0')].join('-');
  }

  function finiteNonNegative(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }

  function calculateNetWorth(assets, investments, debts) {
    const safeAssets = Array.isArray(assets) ? assets : [];
    const names = new Set(safeAssets.map(a => String(a && a.name || '').trim().toLowerCase()).filter(Boolean));
    const assetValue = safeAssets.reduce((sum, a) => sum + finiteNonNegative(a && a.value), 0);
    const investmentValue = (Array.isArray(investments) ? investments : [])
      .filter(i => !names.has(String(i && i.name || '').trim().toLowerCase()))
      .reduce((sum, i) => sum + finiteNonNegative(i && (i.currentValue ?? i.capital)), 0);
    const debtValue = (Array.isArray(debts) ? debts : []).reduce((sum, d) => sum + finiteNonNegative(d && d.balance), 0);
    return assetValue + investmentValue - debtValue;
  }

  function calculateMonthlySavings(income, expenses, uncapturedSubscriptions, uncapturedDebtPayments) {
    return finiteNonNegative(income) - finiteNonNegative(expenses)
      - finiteNonNegative(uncapturedSubscriptions) - finiteNonNegative(uncapturedDebtPayments);
  }

  function calculateDebtToIncome(monthlyDebtPayments, monthlyGrossIncome) {
    const income = finiteNonNegative(monthlyGrossIncome);
    return income > 0 ? Math.round(finiteNonNegative(monthlyDebtPayments) / income * 100) : 0;
  }

  function calculateRunwayMonths(liquidAssets, monthlyExpenses) {
    const expenses = finiteNonNegative(monthlyExpenses);
    return expenses > 0 ? finiteNonNegative(liquidAssets) / expenses : 0;
  }

  function calculateBusinessCapitalAvailable(liquidAssets, emergencyReserve) {
    return Math.max(0, finiteNonNegative(liquidAssets) - finiteNonNegative(emergencyReserve));
  }

  function csvCell(value, protectFormula = true) {
    let text = String(value == null ? '' : value);
    if (protectFormula && /^[\\t\\r\\n ]*[=+@-]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function validateBackup(data) {
    const fail = message => ({ valid: false, error: message });
    if (!data || typeof data !== 'object' || Array.isArray(data)) return fail('Backup must be a JSON object.');
    if (data.settings != null && (typeof data.settings !== 'object' || Array.isArray(data.settings))) return fail('Settings must be an object.');
    const arrayFields = ['transactions','assets','recurringTx','debts','savingsGoals','subscriptions','investments','opportunities','assetGrowthHistory','netWorthHistory'];
    for (const field of arrayFields) {
      if (data[field] != null && !Array.isArray(data[field])) return fail(field + ' must be an array.');
    }
    for (const [index, tx] of (data.transactions || []).entries()) {
      if (!tx || typeof tx !== 'object' || !DATE_RE.test(tx.date || '') ||
          !['income','expense'].includes(tx.type) || !Number.isFinite(Number(tx.amount)) ||
          typeof tx.desc !== 'string') return fail('Transaction ' + (index + 1) + ' is invalid.');
    }
    for (const [index, asset] of (data.assets || []).entries()) {
      if (!asset || typeof asset !== 'object' || typeof asset.name !== 'string' ||
          !asset.name.trim() || !Number.isFinite(Number(asset.value)) || Number(asset.value) < 0) {
        return fail('Asset ' + (index + 1) + ' is invalid.');
      }
    }
    for (const [index, rule] of (data.recurringTx || []).entries()) {
      if (!rule || typeof rule !== 'object' || typeof rule.desc !== 'string' ||
          !Number.isFinite(Number(rule.amount)) || Number(rule.amount) <= 0 ||
          !DATE_RE.test(rule.nextDate || '') ||
          !['monthly','weekly','biweekly'].includes(rule.frequency)) {
        return fail('Recurring rule ' + (index + 1) + ' is invalid.');
      }
    }
    return { valid: true, error: null };
  }

  return Object.freeze({
    TRANSFER_CATEGORIES, localDateKey, localMonthKey, nextRecurringDate,
    calculateNetWorth, calculateMonthlySavings, calculateDebtToIncome,
    calculateRunwayMonths, calculateBusinessCapitalAvailable, csvCell, validateBackup
  });
});
