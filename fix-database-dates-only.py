import sqlite3

# Connect to the database
conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
cursor = conn.cursor()

print("Starting database fix process...")

# First, let's back up the table
print("Creating backup table...")
cursor.execute("CREATE TABLE IF NOT EXISTS movements_backup AS SELECT * FROM movements")
conn.commit()

# Fix date format - convert DD/MM/YYYY to YYYY-MM-DD
print("Fixing date formats...")
cursor.execute("""
UPDATE movements
SET operation_date = 
    substr(operation_date, 7, 4) || '-' || 
    substr(operation_date, 4, 2) || '-' || 
    substr(operation_date, 1, 2)
WHERE operation_date LIKE '__/__/____'
""")

cursor.execute("""
UPDATE movements
SET value_date = 
    substr(value_date, 7, 4) || '-' || 
    substr(value_date, 4, 2) || '-' || 
    substr(value_date, 1, 2)
WHERE value_date LIKE '__/__/____'
""")

# Check sign distribution (but don't modify)
cursor.execute("SELECT SUM(amount) FROM movements WHERE amount > 0")
total_positive = cursor.fetchone()[0] or 0

cursor.execute("SELECT SUM(amount) FROM movements WHERE amount < 0")
total_negative = cursor.fetchone()[0] or 0

print(f"Total positive amount (income): {total_positive}")
print(f"Total negative amount (expenses): {total_negative}")

# Commit changes
conn.commit()

# Verify the fixes
cursor.execute("SELECT MIN(operation_date), MAX(operation_date) FROM movements")
date_range = cursor.fetchone()
print(f"Date range after fix: {date_range[0]} to {date_range[1]}")

cursor.execute("""
SELECT 
    substr(operation_date, 1, 7) as month,
    SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expenses,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
    SUM(amount) as net,
    COUNT(*) as count
FROM movements
GROUP BY month
ORDER BY month
LIMIT 5
""")

print("\nSample of monthly data after fix:")
print("Month      | Expenses    | Income      | Net         | Count")
print("-" * 65)
for row in cursor.fetchall():
    print(f"{row[0]} | {row[1]:11.2f} | {row[2]:11.2f} | {row[3]:11.2f} | {row[4]}")

# Create indices if they don't exist to improve query performance
print("\nCreating indices for better performance...")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_operation_date ON movements(operation_date)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_amount ON movements(amount)")
cursor.execute("CREATE INDEX IF NOT EXISTS idx_description ON movements(description)")

conn.commit()
conn.close()

print("\nDatabase fix complete!")