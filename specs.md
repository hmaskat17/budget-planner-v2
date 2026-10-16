# Budget Planner

## Household

- Has at minimum one person and a maximum of two
- Uses Euros as currency
- Numbers and percentages use two decimal percision

## Person

- One of two persons of a household
- Each person has a name

## Scenario

A concept where the user can choose between different component scenarios. For example, income scenario "Normal" uses a normal salary and income scenario "Raised" uses a raised salary. Switching between scenarios is a useful way to compare calculated results when values change.

## Income

- Show the total income of each person
- Show the combined household income
- Final total is calculated from multiple income sources (e.g. social benefits etc)
- An income scenario (which includes a collection of income sources) can be saved and loaded as a preset. This is useful when comparing changes in income, e.g. normal salary, raised salary etc.
- At minimum, one income source is always required

### Example

Person A
Salary: 3500
Benefits: 200
Total: 3700

Person B
Benefits: 500
Total: 500

Household income: 4200

Person A then loads another income scenario, so their incomes now become:

Salary: 4000
Total: 4000

The new Household income is then: 4500.

### Model

Income
- name
- amount
- scenario

## Personal Expense

- Shows the total personal expense for each person
- Final total personal expenses for a person is derived from multiple personal expense sources (e.g. phone bill, medicine etc)
- Shows the combined personal expenses for a household
- A personal expense scenario can be saved and loaded as a preset.

## Shared Expense

- Each shared expense list item belongs to a person
- Shows each persons total shared expense
- Shows total combined shared expenses from all persons
- Final shared expenses are derived from multiple sources (e.g. streaming, rent, electricity, internet, groceries, loans etc)
- A shared expense scenario can be saved and loaded as a preset


## Remaining balance (unallocated)

- Unallocated remaining balance for each person after expenses. Calculation: Person's total income - person's total expenses.
- Total unallocated remaining balance for a household

## Savings

- Shown as a list of percentages of the remaining balance
- Show the amount in currency after percentage
- Savings are not counted as an expense
- Total savings percentages cannot exceed 100%
- Percentage totals that are less than 100% are allowed with remaining percentage being unallocated savings
- Each person can allocated their own personal savings using percentages
- Each person can optionally distribute an amount of their own remaining money as a percentage to the households shared savings. Shared savings can be allocated using percentages.
- Savings do not use scenarios

Note: It is possible for there to be a total of three different savings, one for each persons personal savings and one shared household savings.

### Example

Person A has 500 remaining money. Person B has 100 remaining money. Person A distributes 100 to shared savings and Person B 20. Person A allocates their personal savings to "New Phone: 20%" and "Clothes: 30%" leaving remaing 50% as unallocated. Person B does not allocate anything. In shared savings a "Car purchase" allocation is created with 100% as the value.

## Contributions methods

Contributions is used to determine the splitting methods for the household.

Should include the following:
- Total household income
- Each persons contributions as rounded percentages. Round by 2 decimals.
- Total household expenses
- Each person's share of expenses. Calculation: Peron's proportional contribution * total household expenses.
- Each person's already paid expenses. This is the same as the total from a person's shared expenses total.
- Each perons's balance to be settled. Calculation: Persons share of expenses - already paid expenses.

Should give options for preferred contribution methods. The app defaults to proportional for two persons and pooled for one household (i.e. one person):
- Equal: Both people pay the same amount towards shared expenses, regardless of their income.
- Proportional: Each person pays a share of expenses corresponding to their share of the household's combined income.
- Equal leftover: Shared expenses are divided so that both people have the same amount of personal money remaining afterwards.
- Fully pooled: All income and shared expenses are treated as belonging to the household rather than to individual earners.
- Custom split: The couple sets their own percentages.

There should be an option to set the balance to be settled as a persons income or expense, depending on which it is.

## Unallocated assets

- Lists each persons money and assets from other sources (e.g. other bank account, gold, cash)
- Final totals are derived from the multiple sources
- Unallocated assets are purely informational to the budget and are not used in calculations