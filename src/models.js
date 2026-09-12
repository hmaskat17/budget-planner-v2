/**
 * @typedef {Object} Person
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} Entry
 * @property {string} name
 * @property {number} amount
 */

/**
 * @typedef {Object} Scenario
 * @property {string} id
 * @property {string} name
 * @property {Entry[]} entries
 */

/**
 * @typedef {Object} SavingsItem
 * @property {string} id
 * @property {string} name
 * @property {number} percent
 */

/**
 * @typedef {Object} PersonSavingsData
 * @property {number} sharedContributionPercent
 * @property {SavingsItem[]} items
 */

export {};
