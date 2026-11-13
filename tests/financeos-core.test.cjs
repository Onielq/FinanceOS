'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../financeos-core.js');

test('local date keys use local calendar fields', () => {
  const value = new Date(2026, 10, 1, 0, 15);
  assert.equal(core.localDateKey(value), '2026-11-01');
  assert.equal(core.localMonthKey(value), '2026-11');
});

test('monthly recurring dates clamp to the target month without skipping it', () => {
  assert.equal(core.nextRecurringDate('2026-01-31', 'monthly', 31), '2026-02-28');
  assert.equal(core.nextRecurringDate('2024-01-31', 'monthly', 31), '2024-02-29');
  assert.equal(core.nextRecurringDate('2026-03-31', 'monthly', 31), '2026-04-30');
});

test('weekly and biweekly schedules advance by the expected number of days', () => {
  assert.equal(core.nextRecurringDate('2026-11-13', 'weekly', 13), '2026-11-20');
  assert.equal(core.nextRecurringDate('2026-11-13', 'biweekly', 13), '2026-11-27');
});

test('net worth deduplicates investments already represented as assets and subtracts debt', () => {
  assert.equal(core.calculateNetWorth(
    [{name:'Cash',value:1000},{name:'Bond',value:500}],
    [{name:'bond',currentValue:500},{name:'Fund',currentValue:200}],
    [{balance:300}]
  ), 1400);
});

test('monthly savings subtracts only explicitly uncaptured obligations and can be negative', () => {
  assert.equal(core.calculateMonthlySavings(1000000, 600000, 0, 0), 400000);
  assert.equal(core.calculateMonthlySavings(1000000, 600000, 50000, 100000), 250000);
  assert.equal(core.calculateMonthlySavings(100000, 150000, 0, 0), -50000);
});

test('debt-to-income uses monthly payments divided by monthly gross income', () => {
  assert.equal(core.calculateDebtToIncome(100000, 1000000), 10);
  assert.equal(core.calculateDebtToIncome(100000, 0), 0);
});

test('runway uses liquid reserves divided by monthly expenses', () => {
  assert.equal(core.calculateRunwayMonths(1200000, 400000), 3);
  assert.equal(core.calculateRunwayMonths(1200000, 0), 0);
});

test('startup capital excludes the emergency reserve from liquid funds', () => {
  assert.equal(core.calculateBusinessCapitalAvailable(2000000, 1200000), 800000);
  assert.equal(core.calculateBusinessCapitalAvailable(100000, 1200000), 0);
});

test('CSV cells escape quotes and neutralize formula-leading text', () => {
  assert.equal(core.csvCell('He said "hi"'), '"He said ""hi"""');
  assert.equal(core.csvCell('=HYPERLINK("x")'), '"\'=HYPERLINK(""x"")"');
});

test('backup validation rejects invalid transaction and array shapes before import', () => {
  assert.equal(core.validateBackup({transactions: 'not-an-array'}).valid, false);
  assert.equal(core.validateBackup({transactions:[{date:'2026-02-30',type:'expense',amount:1,desc:'x'}]}).valid, false);
  assert.equal(core.validateBackup({transactions:[{date:'2026-11-13',type:'expense',amount:100,desc:'Food'}],assets:[]}).valid, true);
});
