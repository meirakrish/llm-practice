from os import path


def read_file(filename):
    if not path.isfile(filename):
        print("input file does not exist")
        exit(1)

    with open(filename, "r", encoding="utf-8") as file:
        content = file.read()
    return content


def get_mapping(text):
    stoi = {}
    itos = {}

    chars = sorted(set(text))
    for index, char in enumerate(chars):
        stoi[char] = index
        itos[index] = char

    return stoi, itos


def encode(mappings, text):
    encoded = []

    for char in text:
        i = mappings[char]
        encoded.append(i)

    return encoded


def decode(mappings, encoded):
    decoded = []

    for index in encoded:
        char = mappings[index]
        decoded.append(char)

    return "".join(decoded)


input_file = "input.txt"
text = read_file(input_file)
stoi, itos = get_mapping(text)
vocab_size = len(stoi)

print("vocabulary size:", vocab_size)
print("decode test:", decode(itos, encode(stoi, text)) == text)
