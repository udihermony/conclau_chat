import sqlite3

# Spanish to English column mappings:
# Fecha de operación -> operation_date
# Fecha valor -> value_date
# Concepto -> description
# Importe -> amount
# Divisa (first occurrence) -> currency
# Saldo -> balance
# Divisa (second occurrence) -> balance_currency
# Nº mov -> transaction_number
# Oficina -> branch_office

# Create or connect to the database
conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
cursor = conn.cursor()

# Drop the existing movements table if it exists
cursor.execute("DROP TABLE IF EXISTS movements")

# Create the new movements table with translated column names
cursor.execute('''
CREATE TABLE movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operation_date TEXT,         -- Fecha de operación
    value_date TEXT,             -- Fecha valor
    description TEXT,            -- Concepto
    amount REAL,                 -- Importe
    currency TEXT,               -- Divisa (for amount)
    balance REAL,                -- Saldo
    balance_currency TEXT,       -- Divisa (for balance)
    transaction_number TEXT,     -- Nº mov
    branch_office TEXT           -- Oficina
)
''')

# Create indices for faster querying
cursor.execute("CREATE INDEX idx_operation_date ON movements(operation_date)")
cursor.execute("CREATE INDEX idx_value_date ON movements(value_date)")
cursor.execute("CREATE INDEX idx_amount ON movements(amount)")
cursor.execute("CREATE INDEX idx_description ON movements(description)")

# Commit changes and close connection
conn.commit()
print("Database schema created successfully!")

# Print the table schema for verification
cursor.execute("PRAGMA table_info(movements)")
columns = cursor.fetchall()
print("\nTable structure:")
for col in columns:
    print(f"  {col[1]} ({col[2]})")

conn.close()