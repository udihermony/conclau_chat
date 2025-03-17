from flask import Flask, request, jsonify
import sqlite3

app = Flask(__name__)

# MCP discovery endpoint (required by MCP spec)
@app.route("/.well-known/mcp-discovery", methods=["GET"])
def mcp_discovery():
    return jsonify({
        "name": "Local Database MCP Server",
        "description": "Access a local SQLite database",
        "tools": [
            {
                "name": "query_database",
                "description": "Run a SQL SELECT query on the local database",
                "parameters": {
                    "query": {"type": "string", "description": "SQL SELECT query"}
                }
            }
        ]
    })

# Tool endpoint to handle database queries
@app.route("/mcp/tools/query_database", methods=["POST"])
def query_database():
    data = request.json
    query = data.get("query")

    try:
        conn = sqlite3.connect("mydb.db")
        cursor = conn.cursor()
        cursor.execute(query)
        results = cursor.fetchall()
        conn.close()
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == "__main__":
    app.run(host="localhost", port=5000)


# def query_database(query):
    # import sqlite3
    # conn = sqlite3.connect("mydb.db")
    # cursor = conn.cursor()
    # cursor.execute(query)
    # results = cursor.fetchall()
    # conn.close()
    # return {"results": results}
