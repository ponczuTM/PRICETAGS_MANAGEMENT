import os


os.makedirs("services", exist_ok=True)

files = {
    "services/__init__.py": "",  # Empty init file
}

for file_path, content in files.items():
    with open(file_path, "w") as f:
        f.write(content)
