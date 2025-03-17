import sqlite3

# Connect to the database
conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
cursor = conn.cursor()

print("Starting database cleanup process...")

# First, let's create a backup of the current data
print("Creating backup table...")
cursor.execute("DROP TABLE IF EXISTS movements_backup_old")
cursor.execute("CREATE TABLE IF NOT EXISTS movements_backup_old AS SELECT * FROM movements")
conn.commit()
print("Backup created as 'movements_backup_old'")

# Get count of records before deletion
cursor.execute("SELECT COUNT(*) FROM movements")
count_before = cursor.fetchone()[0]
print(f"Current number of records: {count_before}")

# Delete all records from the movements table
print("Deleting all records from the movements table...")
cursor.execute("DELETE FROM movements")
conn.commit()

# Verify the deletion
cursor.execute("SELECT COUNT(*) FROM movements")
count_after = cursor.fetchone()[0]
print(f"Number of records after deletion: {count_after}")

# Reset the autoincrement counter for the ID column (if it uses autoincrement)
print("Resetting the autoincrement counter...")
cursor.execute("DELETE FROM sqlite_sequence WHERE name='movements'")
conn.commit()

print("\nTable cleared successfully!")
print("You can now import your new data.")
print("If needed, you can access the old data in the 'movements_backup_old' table.")

conn.close()