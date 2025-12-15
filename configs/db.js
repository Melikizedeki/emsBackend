import mysql from 'mysql'
import dotenv from 'dotenv'

dotenv.config()

const con = mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "EMS"
})

con.connect(function(err) {
    if(err) {
        console.error("❌ Database connection error:", err.message)
        process.exit(1)
    } else {
        // connection success log removed for production
    }
})

// Reconnect on connection drop
con.on('error', (err) => {
    console.error('❌ Database error:', err)
    if(err.code === 'PROTOCOL_CONNECTION_LOST') {
        con.connect()
    }
})

export default con;

