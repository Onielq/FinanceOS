(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FinanceOSCore = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';

  const TRANSFER_CATEGORIES = Object.freeze(['savings', 'investment', 'sacco', 'umworo', 'momo']);
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const finite = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const nonNegative = value => Math.max(0, finite(value));

  function localDateISO(date) {
    const d = date instanceof Date ? date : new Date(date);
    if (!Number.isFinite(d.getTime())) throw new TypeError('Invalid date');
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function localMonthISO(date) {
    return localDateISO(date).slice(0, 7);
  }

  function parseISODate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new TypeError('Date must use YYYY-MM-DD format');
    }
    const parts = value.split('-').map(Number);
    const year = parts[0], month = parts[1], day = parts[2];
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new TypeError('Invalid calendar date');
    }
    return { year, month, day };
  }

  function addRecurringDate(isoDate, frequency, anchorDay) {
    const parts = parseISODate(isoDate);
    const year = parts.year, month = parts.month, day = parts.day;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (frequency === 'weekly' || frequency === 'biweekly') {
      date.setUTCDate(date.getUTCDate() + (frequency === 'weekly' ? 7 : 14));
      return date.toISOString().slice(0, 10);
    }
    if (frequency !== 'monthly') throw new TypeError('Unsupported recurring frequency: ' + frequency);

    const monthIndex = year * 12 + (month - 1) + 1;
    const targetYear = Math.floor(monthIndex / 12);
    const targetMonthIndex = monthIndex % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
    const preferredDay = Number.isInteger(Number(anchorDay)) ? Number(anchorDay) : day;
    const targetDay = Math.min(Math.max(1, preferredDay), daysInTargetMonth);
    return targetYear + '-' + String(targetMonthIndex + 1).padStart(2, '0') + '-' + String(targetDay).padStart(2, '0');
  }

  function isRealExpense(transaction) {
    return !!transaction && transaction.type === 'expense' && !TRANSFER_CATEGORIES.includes(String(transaction.cat || '').toLowerCase());
  }

  function getMonthlyExpenseSnapshot(transactions, monthlyIncome, referenceDate) {
    const txs = Array.isArray(transactions) ? transactions : [];
    const reference = referenceDate instanceof Date ? referenceDate : (referenceDate ? new Date(referenceDate) : new Date());
    const month = localMonthISO(reference);
    const current = txs.filter(tx => isRealExpense(tx) && typeof tx.date === 'string' && tx.date.startsWith(month));
    if (current.length) {
      return {
        amount: Math.abs(current.reduce((sum, tx) => sum + finite(tx.amount), 0)),
        estimated: false,
        basis: 'current-month-transactions',
        period: month,
      };
    }

    const byMonth = new Map();
    txs.filter(isRealExpense).forEach(tx => {
      if (typeof tx.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) return;
      const key = tx.date.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) || 0) + finite(tx.amount));
    });
    const previousMonths = [...byMonth.keys()].filter(key => key < month).sort().reverse();
    if (previousMonths.length) {
      const period = previousMonths[0];
      return {
        amount: Math.abs(byMonth.get(period)),
        estimated: true,
        basis: 'most-recent-recorded-month',
        period: period,
      };
    }

    return {
      amount: Math.round(nonNegative(monthlyIncome) * 0.6),
      estimated: true,
      basis: 'income-based-estimate',
      period: null,
    };
  }

  function calculateNetWorth(assets, investments, debts) {
    const assetRows = Array.isArray(assets) ? assets : [];
    const investmentRows = Array.isArray(investments) ? investments : [];
    const debtRows = Array.isArray(debts) ? debts : [];
    const assetNames = new Set();
    const investmentNames = new Set();

    const totalAssets = assetRows.reduce((sum, asset) => {
      if (asset && typeof asset.name === 'string' && asset.name.trim()) assetNames.add(asset.name.trim().toLowerCase());
      return sum + nonNegative(asset && asset.value);
    }, 0);
    const additionalInvestments = investmentRows.reduce((sum, investment) => {
      const name = investment && typeof investment.name === 'string' ? investment.name.trim().toLowerCase() : '';
      if (name && (assetNames.has(name) || investmentNames.has(name))) return sum;
      if (name) investmentNames.add(name);
      const value = investment && investment.currentValue !== undefined && investment.currentValue !== null
        ? investment.currentValue
        : investment && investment.capital;
      return sum + nonNegative(value);
    }, 0);
    const totalDebt = debtRows.reduce((sum, debt) => sum + nonNegative(debt && debt.balance), 0);
    return totalAssets + additionalInvestments - totalDebt;
  }

  function monthlySubscriptionAmount(subscription) {
    const amount = nonNegative(subscription && subscription.amount);
    if (subscription && subscription.cycle === 'yearly') return amount / 12;
    if (subscription && subscription.cycle === 'weekly') return amount * 52 / 12;
    return amount;
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function calculateMonthlySavings(options) {
    const input = options || {};
    const currentMonth = input.month || localMonthISO(new Date());
    const monthlyTransactions = (Array.isArray(input.transactions) ? input.transactions : []).filter(tx =>
      tx && tx.type === 'expense' && typeof tx.date === 'string' && tx.date.startsWith(currentMonth)
    );

    function isTracked(obligation, idFields) {
      const id = obligation && obligation.id !== undefined ? String(obligation.id) : '';
      const name = normalizeText(obligation && (obligation.name || obligation.description || obligation.lender || obligation.service));
      const recurringId = obligation && obligation.recurringId !== undefined ? String(obligation.recurringId) : '';
      return monthlyTransactions.some(tx => {
        for (const field of idFields) {
          if (id && tx[field] !== undefined && String(tx[field]) === id) return true;
        }
        if (recurringId && tx.recurringId !== undefined && String(tx.recurringId) === recurringId) return true;
        const description = normalizeText(String(tx.desc || tx.description || '') + ' ' + String(tx.note || tx.notes || ''));
        return !!name && description.includes(name);
      });
    }

    const untrackedSubscriptions = (Array.isArray(input.subscriptions) ? input.subscriptions : [])
      .filter(subscription => subscription && subscription.status === 'active')
      .filter(subscription => !isTracked(subscription, ['subscriptionId', 'subId', 'linkedSubscriptionId']))
      .reduce((sum, subscription) => sum + monthlySubscriptionAmount(subscription), 0);

    const untrackedDebtPayments = (Array.isArray(input.debts) ? input.debts : [])
      .filter(debt => debt && !isTracked(debt, ['debtId', 'loanId', 'linkedDebtId']))
      .reduce((sum, debt) => sum + nonNegative(debt.monthly), 0);

    return finite(input.income) - finite(input.expenses) - untrackedSubscriptions - untrackedDebtPayments;
  }

  function calculateBusinessMetrics(options) {
    const input = options || {};
    const liquidTypes = new Set(['cash', 'emergency_fund']);
    const liquidSavings = (Array.isArray(input.assets) ? input.assets : []).reduce((sum, asset) => {
      if (!asset || !liquidTypes.has(String(asset.type || '').toLowerCase())) return sum;
      return sum + nonNegative(asset.value);
    }, 0);
    const monthlyExpenses = nonNegative(input.expenses);
    const monthlyIncome = nonNegative(input.income);
    const debtPayments = nonNegative(input.monthlyDebtPayments);
    return {
      liquidSavings: liquidSavings,
      availableLiquidCapital: Math.max(0, liquidSavings - nonNegative(input.emergencyFundTarget)),
      runwayMonths: monthlyExpenses > 0 ? liquidSavings / monthlyExpenses : 0,
      debtToIncome: monthlyIncome > 0 ? debtPayments / monthlyIncome * 100 : 0,
    };
  }

  function validateBackup(payload) {
    if (!isRecord(payload)) throw new Error('Backup must be a JSON object');
    const arrayFields = [
      'transactions', 'assets', 'recurringTx', 'debts', 'savingsGoals',
      'subscriptions', 'investments', 'opportunities', 'assetGrowthHistory', 'netWorthHistory',
    ];
    for (const field of arrayFields) {
      if (payload[field] !== undefined && payload[field] !== null && !Array.isArray(payload[field])) {
        throw new Error('Backup field "' + field + '" must be an array');
      }
    }
    if (payload.settings !== undefined && !isRecord(payload.settings)) {
      throw new Error('Backup settings must be an object');
    }
    (payload.transactions || []).forEach((transaction, index) => {
      if (!isRecord(transaction)) throw new Error('Transaction ' + (index + 1) + ' is invalid');
      if (!Number.isFinite(Number(transaction.amount))) throw new Error('Transaction ' + (index + 1) + ' has an invalid amount');
      if (typeof transaction.type !== 'string' || !transaction.type.trim()) throw new Error('Transaction ' + (index + 1) + ' has no type');
      parseISODate(transaction.date);
    });
    (payload.assets || []).forEach((asset, index) => {
      if (!isRecord(asset)) throw new Error('Asset ' + (index + 1) + ' is invalid');
      if (!Number.isFinite(Number(asset.value)) || Number(asset.value) <= 0) throw new Error('Asset ' + (index + 1) + ' has an invalid value');
    });
    (payload.recurringTx || []).forEach((rule, index) => {
      if (!isRecord(rule)) throw new Error('Recurring rule ' + (index + 1) + ' is invalid');
      if (!Number.isFinite(Number(rule.amount)) || Number(rule.amount) <= 0) throw new Error('Recurring rule ' + (index + 1) + ' has an invalid amount');
      if (rule.nextDate) parseISODate(rule.nextDate);
    });
    for (const field of ['debts', 'subscriptions', 'savingsGoals']) {
      (payload[field] || []).forEach((record, index) => {
        if (!isRecord(record)) throw new Error(field + ' item ' + (index + 1) + ' is invalid');
      });
    }
    return payload;
  }

  return Object.freeze({
    TRANSFER_CATEGORIES: TRANSFER_CATEGORIES,
    localDateISO: localDateISO,
    localMonthISO: localMonthISO,
    parseISODate: parseISODate,
    addRecurringDate: addRecurringDate,
    isRealExpense: isRealExpense,
    getMonthlyExpenseSnapshot: getMonthlyExpenseSnapshot,
    calculateNetWorth: calculateNetWorth,
    monthlySubscriptionAmount: monthlySubscriptionAmount,
    calculateMonthlySavings: calculateMonthlySavings,
    calculateBusinessMetrics: calculateBusinessMetrics,
    validateBackup: validateBackup,
  });
});