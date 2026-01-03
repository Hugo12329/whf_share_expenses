// Helper function to get all participant names
function getParticipantNames() {
    const participantInputs = document.querySelectorAll('#participants-list input[type="text"]');
    return Array.from(participantInputs).map(input => input.value.trim()).filter(name => name !== '');
}

// Function to update all payee dropdowns
function updatePayeeDropdowns() {
    const participantNames = getParticipantNames();
    const payeeSelects = document.querySelectorAll('.expense-payee');

    payeeSelects.forEach(select => {
        const currentSelected = select.value;
        select.innerHTML = ''; // Clear existing options

        participantNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });

        // Try to re-select the previously selected participant, or default to the first one
        if (participantNames.includes(currentSelected)) {
            select.value = currentSelected;
        } else if (participantNames.length > 0) {
            select.value = participantNames[0];
        }
    });
}

// Function to update all involved participants checkboxes
function updateInvolvedParticipantsCheckboxes() {
    const participantNames = getParticipantNames();
    const expenseRows = document.querySelectorAll('#expenses-table tbody tr');

    expenseRows.forEach(row => {
        const involvedGroup = row.querySelector('.involved-participants-group');
        if (!involvedGroup) return;

        // Get currently checked participants for this row
        const currentlyChecked = Array.from(involvedGroup.querySelectorAll('input[type="checkbox"]:checked'))
                                .map(checkbox => checkbox.value);

        involvedGroup.innerHTML = ''; // Clear existing checkboxes

        participantNames.forEach(name => {
            const label = document.createElement('label');
            label.innerHTML = `<input type="checkbox" value="${name}" ${currentlyChecked.includes(name) ? 'checked' : ''}> ${name}`;
            involvedGroup.appendChild(label);
        });
    });
}

// Function to add a new participant input field
function addParticipantInput(name = '') {
    const participantsList = document.getElementById('participants-list');
    const div = document.createElement('div');
    div.classList.add('participant-row');
    div.innerHTML = `
        <input type="text" value="${name}" placeholder="參與者姓名">
        <button class="remove-participant">移除</button>
    `;
    participantsList.appendChild(div);

    div.querySelector('input').addEventListener('input', () => {
        updatePayeeDropdowns();
        updateInvolvedParticipantsCheckboxes();
    });
    div.querySelector('.remove-participant').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent input event from firing if button is inside label
        if (confirm('確定要移除這位參與者嗎？相關的支出紀錄會受影響。')) {
            div.remove();
            updatePayeeDropdowns();
            updateInvolvedParticipantsCheckboxes();
            calculateAndDisplayResults(); // Recalculate after participant removal
        }
    });

    updatePayeeDropdowns();
    updateInvolvedParticipantsCheckboxes();
}

// Function to add a new expense row
function addExpenseRow() {
    const expensesTableBody = document.querySelector('#expenses-table tbody');
    const participantNames = getParticipantNames();

    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><input type="text" class="expense-description" placeholder="說明"></td>
        <td><input type="number" class="expense-amount" value="0" min="0"></td>
        <td><select class="expense-payee"></select></td>
        <td>
            <div class="involved-participants-group"></div>
        </td>
        <td><button class="remove-expense">移除</button></td>
    `;
    expensesTableBody.appendChild(tr);

    // Populate payee dropdown
    const payeeSelect = tr.querySelector('.expense-payee');
    participantNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        payeeSelect.appendChild(option);
    });
    if (participantNames.length > 0) {
        payeeSelect.value = participantNames[0]; // Default to first participant
    }

    // Populate involved participants checkboxes (all checked by default)
    const involvedGroup = tr.querySelector('.involved-participants-group');
    participantNames.forEach(name => {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" value="${name}" checked> ${name}`;
        involvedGroup.appendChild(label);
    });
    
    // Add event listeners for expense row changes
    tr.querySelector('.expense-amount').addEventListener('input', calculateAndDisplayResults);
    tr.querySelector('.expense-payee').addEventListener('change', calculateAndDisplayResults);
    tr.querySelectorAll('.involved-participants-group input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', calculateAndDisplayResults);
    });
    tr.querySelector('.remove-expense').addEventListener('click', () => {
        if (confirm('確定要移除這筆支出嗎？')) {
            tr.remove();
            calculateAndDisplayResults(); // Recalculate after expense removal
        }
    });
}

// Calculation Logic
function calculateAndDisplayResults() {
    const participantNames = getParticipantNames();
    if (participantNames.length === 0) {
        document.getElementById('net-amounts').innerHTML = '<h3>每人淨金額：</h3><p>請先新增參與者。</p>';
        document.getElementById('settlement-suggestions').innerHTML = '<h3>結算建議：</h3>';
        return;
    }

    const netAmounts = {};
    participantNames.forEach(name => netAmounts[name] = 0);

    const expenseRows = document.querySelectorAll('#expenses-table tbody tr');
    expenseRows.forEach(row => {
        const amount = parseFloat(row.querySelector('.expense-amount').value) || 0;
        const payee = row.querySelector('.expense-payee').value;
        const involvedParticipants = Array.from(row.querySelectorAll('.involved-participants-group input[type="checkbox"]:checked'))
                                       .map(checkbox => checkbox.value);

        if (amount > 0 && involvedParticipants.length > 0) {
            const share = amount / involvedParticipants.length;
            // Payee pays full amount initially
            netAmounts[payee] += amount;

            // Each involved participant owes their share
            involvedParticipants.forEach(p => {
                netAmounts[p] -= share;
            });
        }
    });

    displayNetAmounts(netAmounts);
    displaySettlementSuggestions(netAmounts);
}

function displayNetAmounts(netAmounts) {
    const netAmountsDiv = document.getElementById('net-amounts');
    netAmountsDiv.innerHTML = '<h3>每人淨金額：</h3>';
    for (const name in netAmounts) {
        const amount = netAmounts[name];
        const status = amount >= 0 ? '應收' : '應付';
        const color = amount < 0 ? 'red' : 'green';
        netAmountsDiv.innerHTML += `<div>${name}: <span style="color:${color};">${status} ${Math.abs(amount).toFixed(2)} 元</span></div>`;
    }
}

function displaySettlementSuggestions(netAmounts) {
    const suggestionsDiv = document.getElementById('settlement-suggestions');
    suggestionsDiv.innerHTML = '<h3>結算建議：</h3>';

    const debtors = []; // People who owe money (negative net amount)
    const creditors = []; // People who are owed money (positive net amount)

    for (const name in netAmounts) {
        const amount = parseFloat(netAmounts[name].toFixed(2)); // Fix floating point issues
        if (amount < 0) {
            debtors.push({ name: name, amount: -amount }); // Store as positive debt
        } else if (amount > 0) {
            creditors.push({ name: name, amount: amount });
        }
    }
    
    if (debtors.length === 0 && creditors.length === 0) {
        suggestionsDiv.innerHTML += '<p>帳務已結清。</p>';
        return;
    }

    // Sort to prioritize larger payments (optional, but can result in fewer transactions)
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const suggestions = [];
    let transactionCount = 0;

    while (debtors.length > 0 && creditors.length > 0 && transactionCount < 100) { // Limit transactions to prevent infinite loops
        const debtor = debtors[0];
        const creditor = creditors[0];

        const amountToTransfer = Math.min(debtor.amount, creditor.amount);

        if (amountToTransfer > 0.01) { // Only suggest transfers greater than 1 cent
            suggestions.push(`${debtor.name} 付給 ${creditor.name} ${amountToTransfer.toFixed(2)} 元`);
        }

        debtor.amount -= amountToTransfer;
        creditor.amount -= amountToTransfer;

        if (debtor.amount <= 0.01) {
            debtors.shift(); // Debtor's debt is settled
        }
        if (creditor.amount <= 0.01) {
            creditors.shift(); // Creditor is fully paid
        }
        transactionCount++;
    }

    if (suggestions.length === 0 && (debtors.length > 0 || creditors.length > 0)) {
        suggestionsDiv.innerHTML += '<p>所有金額都已結清 (或剩餘金額過小)。</p>';
    } else if (suggestions.length === 0) {
        suggestionsDiv.innerHTML += '<p>帳務已結清。</p>';
    } else {
        suggestions.forEach(s => {
            suggestionsDiv.innerHTML += `<p>${s}</p>`;
        });
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Initial participants
    document.querySelectorAll('.participant-row input[type="text"]').forEach(input => {
        input.addEventListener('input', () => {
            updatePayeeDropdowns();
            updateInvolvedParticipantsCheckboxes();
            calculateAndDisplayResults();
        });
    });
    document.querySelectorAll('.participant-row .remove-participant').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent input event from firing if button is inside label
            if (confirm('確定要移除這位參與者嗎？相關的支出紀錄會受影響。')) {
                button.closest('.participant-row').remove();
            updatePayeeDropdowns();
            updateInvolvedParticipantsCheckboxes();
            calculateAndDisplayResults(); // Recalculate after participant removal
            }
        });
    });

    document.getElementById('add-participant').addEventListener('click', () => {
        addParticipantInput();
        calculateAndDisplayResults();
    });
    document.getElementById('add-expense').addEventListener('click', () => {
        addExpenseRow();
        calculateAndDisplayResults();
    });
    document.getElementById('calculate-button').addEventListener('click', calculateAndDisplayResults);

    // Add some initial expense rows
    addExpenseRow();
    addExpenseRow();

    // Initial calculation
    calculateAndDisplayResults();
});
