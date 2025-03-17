import sqlite3

conn = sqlite3.connect("bank_movements.db")
cursor = conn.cursor()

# Get the min and max dates
cursor.execute("SELECT MIN(operation_date) as min_date, MAX(operation_date) as max_date FROM movements;")
min_date, max_date = cursor.fetchone()

print(f"Earliest date in database: {min_date}")
print(f"Latest date in database: {max_date}")

conn.close()