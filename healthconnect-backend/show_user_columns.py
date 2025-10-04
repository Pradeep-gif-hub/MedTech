import sqlite3

def show_columns(db_path='healthconnect.db'):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info('users')")
    rows = cur.fetchall()
    print('users table columns:')
    for r in rows:
        cid, name, typ, notnull, dflt, pk = r
        print(f"- {name} ({typ}), notnull={notnull}, pk={pk}, default={dflt}")

if __name__ == '__main__':
    show_columns()
