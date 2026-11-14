'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../finance-core.js');

test('monthly recurrence clamps to the actual target month and preserves the anchor day', () => {
  assert.equal(Core.addRecurringDate('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(Core.addRecurringDate('2026-02-28', 'monthly', 31), '2026-03-31');
  assert.equal(Core.addRecurringDate('2028-01-31', 'monthly', 31), '2028-02-29');
});

test('weekly and biweekly recurrence use calendar-day arithmetic', () => {
  assert.equal(Core.addRecurringDate('2026-02-28', 'weekly', 28), '2026-03-07');
  assert.equal(Core.addRecurringDate('2026-02-28', 'biweekly', 28), '2026-03-14');
});

test('net worth includes unmatched investments once and subtracts outstanding debt', () => {
  const total = Core.calculateNetWorth(
    [{ name: 'House', value: 1000 }, { name: 'Cash', value: 300 }],
    [{ name: 'House', currentValue: 900 }, { name: 'Bond fund', currentValue: 200 }],
    [{ balance: 250 }]
  );
  assert.equal(total, 1250);
});

test('monthly savings does not subtract obligations already recorded as transactions', () => {
  const savings = Core.calculateMonthlySavings({
    month: '2026-11',
    income: 1000000,
    expenses: 600000,
    transactions: [
      { date: '2026-11-02', type: 'expense', amount: -50000, desc: 'Netflix subscription' },
      { date: '2026-11-04', type: 'expense', amount: -100000, desc: 'Car loan payment' },
    ],
    subscriptions: [{ id: 's1', name: 'Netflix', amount: 50000, status: 'active', cycle: 'monthly' }],
    debts: [{ id: 'd1', name: 'Car loan', monthly: 100000 }],
  });
  assert.equal(savings, 400000);
});

test('business runway and capital use liquid assets, not property or investment holdings', () => {
  const metrics = Core.calculateBusinessMetrics({
    assets: [
      { type: 'cash', value: 200000 },
      { type: 'emergency_fund', value: 300000 },
      { type: 'property', value: 5000000 },
      { type: 'stock', value: 400000 },
    ],
    expenses: 250000,
    monthlyDebtPayments: 50000,
    income: 500000,
    emergencyFundTarget: 300000,
  });
  assert.equal(metrics.liquidSavings, 500000);
  assert.equal(metrics.availableLiquidCapital, 200000);
  assert.equal(metrics.runwayMonths, 2);
  assert.equal(metrics.debtToIncome, 10);
});

test('expense fallback is explicitly marked as an estimate', () => {
  const snapshot = Core.getMonthlyExpenseSnapshot(
    [{ date: '2026-10-12', type: 'expense', cat: 'housing', amount: -120000 }],
    1000000,
    new Date(2026, 10, 14)
  );
  assert.equal(snapshot.amount, 120000);
  assert.equal(snapshot.estimated, true);
  assert.equal(snapshot.basis, 'most-recent-recorded-month');
});

test('backup validator rejects malformed financial arrays before import', () => {
  assert.throws(() => Core.validateBackup({ transactions: {}, assets: [], recurringTx: [] }), /transactions.*array/i);
  assert.throws(() => Core.validateBackup({ transactions: [{ type: 'expense', amount: 'NaN', date: '2026-11-01' }], assets: [], recurringTx: [] }), /invalid amount/i);
  assert.throws(() => Core.validateBackup({ transactions: [], assets: [{ value: -10 }], recurringTx: [] }), /invalid value/i);
  assert.throws(() => Core.validateBackup({ transactions: [], assets: [], settings: {} }), /recurringTx.*required/i);
  assert.doesNotThrow(() => Core.validateBackup({ version: 'v51', transactions: [], assets: [], recurringTx: [], settings: {} }));
});
test('monthly savings respects a configured non-calendar fiscal period', () => {
  const savings = Core.calculateMonthlySavings({
    periodStart: '2026-11-25',
    periodEnd: '2026-12-24',
    income: 1000000,
    expenses: 600000,
    transactions: [
      { date: '2026-11-27', type: 'expense', cat: 'other', amount: -50000, desc: 'Netflix subscription' },
      { date: '2026-11-29', type: 'expense', cat: 'debt', amount: -100000, desc: 'Car loan payment' },
      { date: '2026-11-10', type: 'expense', cat: 'other', amount: -50000, desc: 'Old month subscription' },
    ],
    subscriptions: [{ id: 's1', name: 'Netflix', amount: 50000, status: 'active', cycle: 'monthly' }],
    debts: [{ id: 'd1', name: 'Car loan', monthly: 100000 }],
  });
  assert.equal(savings, 400000);
});

test('monthly savings subtracts only the unpaid part of a partially recorded obligation', () => {
  const savings = Core.calculateMonthlySavings({
    month: '2026-11',
    income: 1000000,
    expenses: 600000,
    transactions: [
      { date: '2026-11-02', type: 'expense', cat: 'other', amount: -20000, desc: 'Netflix subscription' },
      { date: '2026-11-04', type: 'expense', cat: 'debt', amount: -100000, desc: 'Car loan payment' },
    ],
    subscriptions: [{ id: 's1', name: 'Netflix', amount: 50000, status: 'active', cycle: 'monthly' }],
    debts: [{ id: 'd1', name: 'Car loan', monthly: 100000 }],
  });
  assert.equal(savings, 370000);
});
