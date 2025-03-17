import sqlite3
import csv
import sys
import datetime
import locale

def parse_date(date_str):
    """Parse date string from Spanish format to YYYY-MM-DD"""
    try:
        # Try to parse as DD/MM/YYYY
        day, month, year = date_str.split('/')
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    except ValueError:
        try:
            # Try to parse as DD-MM-YYYY
            day, month, year = date_str.split('-')
            return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        except ValueError:
            print(f"Warning: Could not parse date '{date_str}', using as-is")
            return date_str

def parse_amount(amount_str):
    """Parse amount string to float, handling Spanish number format"""
    if not amount_str:
        return 0.0
    
    # Remove any currency symbols and spaces
    cleaned = amount_str.replace('€', '').replace('$', '').strip()
    
    try:
        # Try with Spanish locale (comma as decimal separator)
        cleaned = cleaned.replace('.', '').replace(',', '.')
        return float(cleaned)
    except ValueError:
        try:
            # Try with English locale (period as decimal separator)
            return float(cleaned)
        except ValueError:
            print(f"Warning: Could not parse amount '{amount_str}', using 0.0")
            return 0.0

def import_csv(csv_file):
    """Import bank data from CSV file"""
    try:
        # Connect to database
        conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
        cursor = conn.cursor()
        
        # Get current number of rows in the table
        cursor.execute("SELECT COUNT(*) FROM movements")
        start_count = cursor.fetchone()[0]
        
        # Prepare column mappings (CSV header to database columns)
        # Adjust these based on your actual CSV headers
        column_mapping = {
            'operation_date': 'operation_date',
            'value_date': 'value_date',
            'description': 'description',
            'amount': 'amount',
            'currency': 'currency',  # This will be mapped twice
            'balance': 'balance',
            'transaction_number': 'transaction_number',
            'branch_office': 'branch_office'
        }
        
        # Open and read the CSV file
        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            # Detect the delimiter (comma, semicolon, etc.)
            sample = f.read(1024)
            f.seek(0)
            
            if ';' in sample:
                delimiter = ';'
            else:
                delimiter = ','
                
            print(f"Using delimiter: '{delimiter}'")
            
            reader = csv.DictReader(f, delimiter=delimiter)
            headers = reader.fieldnames
            
            if not headers:
                print("Error: CSV file has no headers")
                return
                
            print(f"CSV headers found: {headers}")
            
            # Check if 'Divisa' appears twice
            divisa_count = headers.count('Divisa')
            
            # Track the rows inserted
            rows_inserted = 0
            
            # Process each row
            for row in reader:
                # Prepare data for insertion
                data = {}
                currency = None
                balance_currency = None
                
                for csv_col, db_col in column_mapping.items():
                    if csv_col in row:
                        if csv_col == 'Fecha de operación' or csv_col == 'Fecha valor':
                            data[db_col] = parse_date(row[csv_col])
                        elif csv_col == 'Importe':
                            data[db_col] = parse_amount(row[csv_col])
                        elif csv_col == 'Saldo':
                            data[db_col] = parse_amount(row[csv_col])
                        elif csv_col == 'Divisa':
                            # If Divisa appears twice, handle it properly
                            if divisa_count == 2:
                                if currency is None:
                                    currency = row[csv_col]
                                else:
                                    balance_currency = row[csv_col]
                            else:
                                currency = row[csv_col]
                                balance_currency = row[csv_col]
                        else:
                            data[db_col] = row[csv_col]
                
                # Add currencies to data
                if currency:
                    data['currency'] = currency
                if balance_currency:
                    data['balance_currency'] = balance_currency
                elif currency:
                    data['balance_currency'] = currency
                
                # Build the SQL query dynamically
                columns = ', '.join(data.keys())
                placeholders = ', '.join(['?' for _ in data])
                
                sql = f"INSERT INTO movements ({columns}) VALUES ({placeholders})"
                
                try:
                    cursor.execute(sql, list(data.values()))
                    rows_inserted += 1
                except sqlite3.Error as e:
                    print(f"Error inserting row: {e}")
                    print(f"Row data: {data}")
                
                # Commit every 100 rows to avoid large transactions
                if rows_inserted % 100 == 0:
                    conn.commit()
                    print(f"Imported {rows_inserted} rows so far...")
            
            # Final commit
            conn.commit()
            
            # Get new row count
            cursor.execute("SELECT COUNT(*) FROM movements")
            end_count = cursor.fetchone()[0]
            
            print(f"\nImport complete!")
            print(f"Initial rows: {start_count}")
            print(f"Rows inserted: {rows_inserted}")
            print(f"Final row count: {end_count}")
            
            # Print a few sample rows
            print("\nSample of imported data:")
            cursor.execute("SELECT * FROM movements ORDER BY operation_date DESC LIMIT 5")
            sample_rows = cursor.fetchall()
            
            cursor.execute("PRAGMA table_info(movements)")
            col_names = [col[1] for col in cursor.fetchall()]
            
            for row in sample_rows:
                print("\n" + "-"*50)
                for i, col in enumerate(col_names):
                    print(f"{col}: {row[i]}")
                
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python import_bank_data.py <csv_file>")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    import_csv(csv_file)