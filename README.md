# Gym Management System

## Run with XAMPP

1. Start **Apache** and **MySQL** in the XAMPP Control Panel.
2. Open `http://localhost/phpmyadmin`, select **Import**, choose `setup.sql` from this folder, and run the import.
3. Open `http://localhost/gym%20management%20system/` in your browser. Do not open `index.html` directly as a file; the PHP API needs Apache.

The database is named `gym_management`. The API uses the standard XAMPP MySQL defaults (`127.0.0.1`, user `root`, no password). If your MySQL credentials differ, set `GYM_DB_HOST`, `GYM_DB_NAME`, `GYM_DB_USER`, and `GYM_DB_PASSWORD` in the Apache/PHP environment before starting Apache.

The database stores membership plans, members, and check-in/check-out history. The SQL import includes sample members and plans; remove the sample rows from `setup.sql` before importing if you prefer to start with an empty member list. Plan prices are displayed in Philippine pesos (PHP), and member phone examples use Philippine `+63` mobile-number format.
