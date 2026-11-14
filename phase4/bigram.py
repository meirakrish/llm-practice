from math import floor
from os import path
import torch
import torch.nn as nn
import torch.nn.functional as F


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


def get_batch(data, batch_size, block_size):
    xs = []
    ys = []

    ix = torch.randint(low=0, high=len(data) - block_size, size=(batch_size,))

    for i in ix:
        xs.append(data[i : i + block_size])
        ys.append(data[i + 1 : i + block_size + 1])

    x = torch.stack(xs)
    y = torch.stack(ys)

    return x, y


class BigramLanguageModel(nn.Module):
    def __init__(self, vocab_size):
        super().__init__()
        self.token_embedding_table = nn.Embedding(vocab_size, vocab_size)

    def forward(self, idx, targets=None):
        logits = self.token_embedding_table(idx)
        if targets is None:
            loss = None
        else:
            b, t, c = logits.shape

            cp1 = logits.view(b * t, c)
            cp2 = targets.view(b * t)
            loss = F.cross_entropy(cp1, cp2)

        return logits, loss

    def generate(self, idx, max_new_tokens):
        for i in range(max_new_tokens):
            logits, loss = self(idx)
            last_pos_score = logits[:, -1, :]
            probs = F.softmax(last_pos_score, dim=-1)
            new_id = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, new_id), dim=1)

        return idx


input_file = "input.txt"
text = read_file(input_file)
stoi, itos = get_mapping(text)
vocab_size = len(stoi)

data = torch.tensor(encode(stoi, text), dtype=torch.long)
n90 = floor(len(data) * 0.9)
train_data = data[:n90]
val_data = data[n90:]
block_size = 8
batch_size = 32

# print("n90", n90)
# print("vocabulary size:", vocab_size)
print("decode test:", decode(itos, encode(stoi, text)) == text)
# print("data.shape", data.shape)
# print("data.dtype", data.dtype)
# print("train_data length", len(train_data))
# print("val_data length", len(val_data))

model = BigramLanguageModel(vocab_size)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
x, y = get_batch(train_data, batch_size, block_size)
logits, loss = model(x, y)


# training loop
print("loss before training", loss.item())
for i in range(10000):
    x, y = get_batch(train_data, batch_size, block_size)
    logits, loss = model(x, y)
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    optimizer.step()
print("loss after training", loss.item())


# generate
idx = torch.zeros((1, 1), dtype=torch.long)
generated = model.generate(idx, 300)
decoded = decode(itos, generated[0].tolist())
print("generated:", decoded)
