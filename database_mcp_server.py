from mcp.server.fastmcp import FastMCP
import sqlite3
import time
import signal 
import sys
import json
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

def signal_handler(sig, frame):
    print('Exiting...')
    sys.exit(0)

signal.signal(signal.SIGINT, signal_handler)

# Initialize the MCP server
mcp = FastMCP(
    name="Bank Database MCP Server",
    description="Access a local SQLite database for bank movements",
    host="127.0.0.1",
    port=8080,
    timeout=30
)

def standardize_date(date_str):
    """Convert various date formats to YYYY-MM-DD."""
    if not date_str:
        return None
        
    # If already in YYYY-MM-DD format
    if re.match(r'^\d{4}-\d{2}-\d{2}$', date_str):
        return date_str
        
    # If in DD/MM/YYYY format
    match = re.match(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$', date_str)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
        
    # If in MM/DD/YYYY format (less common)
    match = re.match(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$', date_str)
    if match:
        month, day, year = match.groups()
        return f"{year}-{month.zfill(2)}-{day.zfill(2)}"
    
    # Can't determine format, return as is
    print(f"Warning: Unable to standardize date format for '{date_str}'")
    return date_str

# Define a function to query the database
@mcp.tool(description="Run a SQL query on the bank database")
def query_database(query: str) -> Dict[str, Any]:
    """
    Run a SQL query on the local SQLite database.
    
    Args:
        query: SQL query to execute (SELECT statements only for safety)
        
    Returns:
        A dictionary with results
    """
    try:
        # Basic security check - only allow SELECT queries
        query = query.strip()
        if not query.lower().startswith('select'):
            return {"error": "Only SELECT queries are allowed for security reasons"}
        
        # Connect to the database and execute the query
        conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
        # Return column names along with results
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute(query)
        
        # Convert row objects to dictionaries
        rows = cursor.fetchall()
        results = []
        for row in rows:
            results.append({key: row[key] for key in row.keys()})
            
        conn.close()
        return {"results": results}
    except Exception as e:
        return {"error": str(e)}

# Get database schema
@mcp.tool(description="Get the schema of the database")
def get_schema() -> Dict[str, Any]:
    """
    Get the schema of the SQLite database.
    
    Returns:
        A dictionary with table names and their column information
    """
    try:
        conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
        cursor = conn.cursor()
        
        # Get all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        
        schema = {}
        for table in tables:
            table_name = table[0]
            cursor.execute(f"PRAGMA table_info({table_name});")
            columns = cursor.fetchall()
            
            # Format column information
            column_info = []
            for col in columns:
                column_info.append({
                    "name": col[1],
                    "type": col[2],
                    "notnull": bool(col[3]),
                    "default_value": col[4],
                    "is_primary_key": bool(col[5])
                })
            
            schema[table_name] = column_info
        
        # Also get sample data
        cursor.execute("SELECT * FROM movements ORDER BY operation_date DESC LIMIT 5")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM movements ORDER BY operation_date DESC LIMIT 5")
        sample_rows = []
        for row in cursor.fetchall():
            sample_rows.append({key: row[key] for key in row.keys()})
        
        schema["_sample_data"] = sample_rows
        
        conn.close()
        return {"schema": schema}
    except Exception as e:
        return {"error": str(e)}

# Get bank movements within a date range
@mcp.tool(description="Get bank movements within a date range")
def get_movements_by_date(start_date: str, end_date: str) -> Dict[str, Any]:
    """
    Get bank movements within a specified date range.
    
    Args:
        start_date: Start date in YYYY-MM-DD format
        end_date: End date in YYYY-MM-DD format
        
    Returns:
        A dictionary with matching movements
    """
    try:
        # Standardize date formats
        start_date = standardize_date(start_date)
        end_date = standardize_date(end_date)
        
        conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        query = """
        SELECT * FROM movements 
        WHERE operation_date >= ? AND operation_date <= ?
        ORDER BY operation_date DESC
        """
        
        cursor.execute(query, (start_date, end_date))
        
        rows = cursor.fetchall()
        results = []
        for row in rows:
            results.append({key: row[key] for key in row.keys()})
            
        conn.close()
        return {"movements": results}
    except Exception as e:
        return {"error": str(e)}

# Get spending summary 
@mcp.tool(description="Get monthly spending summary")
def get_monthly_summary(start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Get monthly summary of bank movements.
    
    Args:
        start_date: Optional start date in YYYY-MM-DD format
        end_date: Optional end date in YYYY-MM-DD format
        
    Returns:
        Monthly summary including income, expenses, and balance
    """
    try:
        # Standardize date formats if provided
        if start_date:
            start_date = standardize_date(start_date)
        if end_date:
            end_date = standardize_date(end_date)
        
        conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
        cursor = conn.cursor()
        
        params = []
        date_filter = ""
        
        # Add date filtering if dates are provided
        if start_date and end_date:
            date_filter = "WHERE operation_date >= ? AND operation_date <= ?"
            params = [start_date, end_date]
        elif start_date:
            date_filter = "WHERE operation_date >= ?"
            params = [start_date]
        elif end_date:
            date_filter = "WHERE operation_date <= ?"
            params = [end_date]
        
        # Get monthly summary
        if date_filter:
            cursor.execute(f"""
            SELECT 
                substr(operation_date, 1, 7) as month,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expenses,
                SUM(amount) as net,
                COUNT(*) as transaction_count
            FROM movements 
            {date_filter}
            GROUP BY month
            ORDER BY month
            """, params)
        else:
            cursor.execute("""
            SELECT 
                substr(operation_date, 1, 7) as month,
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
                SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as expenses,
                SUM(amount) as net,
                COUNT(*) as transaction_count
            FROM movements 
            GROUP BY month
            ORDER BY month
            """)
        
        monthly_data = []
        for month, income, expenses, net, count in cursor.fetchall():
            monthly_data.append({
                "month": month,
                "income": income,
                "expenses": expenses,
                "net": net,
                "transaction_count": count
            })
        
        # Get totals
        if date_filter:
            cursor.execute(f"""
            SELECT 
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_expenses,
                SUM(amount) as total_net,
                COUNT(*) as total_transactions
            FROM movements 
            {date_filter}
            """, params)
        else:
            cursor.execute("""
            SELECT 
                SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
                SUM(CASE WHEN amount < 0 THEN amount ELSE 0 END) as total_expenses,
                SUM(amount) as total_net,
                COUNT(*) as total_transactions
            FROM movements 
            """)
        
        total_row = cursor.fetchone()
        totals = {
            "total_income": total_row[0] or 0,
            "total_expenses": total_row[1] or 0,
            "total_net": total_row[2] or 0,
            "total_transactions": total_row[3] or 0
        }
        
        conn.close()
        
        return {
            "monthly_summary": {
                "period": {
                    "start_date": start_date,
                    "end_date": end_date
                },
                "totals": totals,
                "monthly_data": monthly_data
            }
        }
    except Exception as e:
        return {"error": str(e)}

# Categorize spending
@mcp.tool(description="Analyze spending by description pattern")
def analyze_spending_patterns() -> Dict[str, Any]:
    """
    Analyze spending patterns based on transaction descriptions.
    
    Returns:
        Analysis of spending patterns grouped by description
    """
    try:
        conn = sqlite3.connect("/Users/ehud/git_repos/conclau_llm/bank_movements.db")
        cursor = conn.cursor()
        
        # Get top expense categories by description
        cursor.execute("""
        SELECT 
            description,
            COUNT(*) as frequency,
            SUM(amount) as total_amount,
            AVG(amount) as average_amount,
            MIN(operation_date) as first_date,
            MAX(operation_date) as last_date
        FROM movements
        WHERE amount < 0
        GROUP BY description
        ORDER BY ABS(SUM(amount)) DESC
        LIMIT 30
        """)
        
        expense_categories = []
        for desc, freq, total, avg, first, last in cursor.fetchall():
            expense_categories.append({
                "description": desc,
                "frequency": freq,
                "total_amount": total,
                "average_amount": avg,
                "first_date": first,
                "last_date": last
            })
            
        # Get top income sources by description
        cursor.execute("""
        SELECT 
            description,
            COUNT(*) as frequency,
            SUM(amount) as total_amount,
            AVG(amount) as average_amount,
            MIN(operation_date) as first_date,
            MAX(operation_date) as last_date
        FROM movements
        WHERE amount > 0
        GROUP BY description
        ORDER BY SUM(amount) DESC
        LIMIT 20
        """)
        
        income_sources = []
        for desc, freq, total, avg, first, last in cursor.fetchall():
            income_sources.append({
                "description": desc,
                "frequency": freq,
                "total_amount": total,
                "average_amount": avg,
                "first_date": first,
                "last_date": last
            })
            
        # Get recurring transactions (monthly patterns)
        # Focus on transactions that occur regularly
        cursor.execute("""
        WITH monthly_counts AS (
            SELECT 
                description,
                substr(operation_date, 1, 7) as month,
                COUNT(*) as monthly_count
            FROM movements
            GROUP BY description, month
        )
        SELECT 
            m.description,
            AVG(m.amount) as average_amount,
            COUNT(DISTINCT substr(m.operation_date, 1, 7)) as months_present,
            (SELECT COUNT(DISTINCT substr(operation_date, 1, 7)) FROM movements) as total_months,
            SUM(m.amount) as total_amount
        FROM movements m
        JOIN monthly_counts mc ON m.description = mc.description
        GROUP BY m.description
        HAVING 
            months_present >= 3 AND
            ABS(average_amount) > 5
        ORDER BY months_present DESC, ABS(average_amount) DESC
        LIMIT 30
        """)
        
        recurring_transactions = []
        for desc, avg_amount, months_present, total_months, total_amount in cursor.fetchall():
            recurring_transactions.append({
                "description": desc,
                "average_amount": avg_amount,
                "months_present": months_present,
                "total_months": total_months,
                "total_amount": total_amount,
                "consistency": months_present / total_months if total_months > 0 else 0
            })
            
        conn.close()
        
        return {
            "spending_patterns": {
                "expense_categories": expense_categories,
                "income_sources": income_sources,
                "recurring_transactions": recurring_transactions
            }
        }
    except Exception as e:
        return {"error": str(e)}

# Main entry point
if __name__ == "__main__":
    try:
        print("Starting Bank Database MCP Server...")
        mcp.run()
    except Exception as e:
        print(f"Error: {e}")
        time.sleep(5)