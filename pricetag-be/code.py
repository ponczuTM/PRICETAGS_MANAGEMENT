import os

# Funkcja do odczytu zawartości pliku
def read_file(file_path):
    with open(file_path, 'r') as file:
        return file.read()

# Ścieżki do plików
main_py = 'main.py'
models_py = 'models.py'
api_py = 'api.py'
api_location_py = 'api/locations.py'
api_users_py = 'api/users.py'

# Tworzymy plik tekstowy 'code.txt'
with open('aaaaaa.txt', 'w') as output_file:
    output_file.write(f"mam taki {main_py}:\n")
    output_file.write(read_file(main_py))
    output_file.write("\n\n")
    
    output_file.write(f"mam taki {models_py}:\n")
    output_file.write(read_file(models_py))
    output_file.write("\n\n")
    
    output_file.write(f"mam taki {api_py}:\n")
    output_file.write(read_file(api_py))
    output_file.write("\n\n")
    
    output_file.write(f"mam taki {api_location_py}:\n")
    output_file.write(read_file(api_location_py))
    output_file.write("\n\n")
    
    output_file.write(f"mam taki {api_users_py}:\n")
    output_file.write(read_file(api_users_py))

print("Plik 'code.txt' został utworzony.")
