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


@torch.no_grad()
def estimate_loss(model, splits, batch_size, block_size, eval_iters):
    model.eval()
    result = {}

    for key, value in splits.items():
        losses = torch.zeros(eval_iters)

        for k in range(eval_iters):
            x, y = get_batch(value, batch_size, block_size)
            logits, loss = model(x, y)
            losses[k] = loss.item()

        result[key] = losses.mean().item()

    model.train()
    return result


class MultiHeadAttention(nn.Module):
    def __init__(self, num_heads, head_size, n_embd, block_size):
        super().__init__()
        self.heads = nn.ModuleList(
            [Head(n_embd, head_size, block_size) for _ in range(num_heads)]
        )

        self.proj = nn.Linear(num_heads * head_size, n_embd)

    def forward(self, x):
        outs = [head(x) for head in self.heads]
        out = torch.cat(outs, dim=-1)
        return self.proj(out)


class FeedForward(nn.Module):
    def __init__(self, n_embd):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(n_embd, n_embd), nn.ReLU())

    def forward(self, x):
        return self.net(x)


class Block(nn.Module):
    def __init__(self, n_embd, num_heads, block_size):
        super().__init__()
        self.sa = MultiHeadAttention(num_heads, n_embd // num_heads, n_embd, block_size)
        self.ffwd = FeedForward(n_embd)
        self.ln1 = nn.LayerNorm(n_embd)
        self.ln2 = nn.LayerNorm(n_embd)

    def forward(self, x):
        x = x + self.sa(self.ln1(x))
        x = x + self.ffwd(self.ln2(x))
        return x


class Head(nn.Module):
    def __init__(self, n_embd, head_size, block_size):
        super().__init__()

        self.key = nn.Linear(n_embd, head_size, bias=False)
        self.query = nn.Linear(n_embd, head_size, bias=False)
        self.value = nn.Linear(n_embd, head_size, bias=False)
        self.register_buffer("tril", torch.tril(torch.ones(block_size, block_size)))
        self.head_size = head_size

    def forward(self, x):
        _, T, _ = x.shape
        k = self.key(x)
        q = self.query(x)
        v = self.value(x)

        scores = q @ k.transpose(-2, -1) * (self.head_size**-0.5)
        scores = scores.masked_fill(self.tril[:T, :T] == 0, float("-inf"))
        scores = F.softmax(scores, dim=-1)
        return scores @ v


class BigramLanguageModel(nn.Module):
    def __init__(self, vocab_size, n_embd, block_size, num_heads, num_layers):
        super().__init__()
        self.token_embedding_table = nn.Embedding(vocab_size, n_embd)
        self.position_embedding_table = nn.Embedding(block_size, n_embd)
        self.blocks = nn.Sequential(
            *[Block(n_embd, num_heads, block_size) for _ in range(num_layers)]
        )
        self.ln_f = nn.LayerNorm(n_embd)
        self.lm_head = nn.Linear(n_embd, vocab_size)
        self.block_size = block_size

    def forward(self, idx, targets=None):
        _, T = idx.shape
        tok_emb = self.token_embedding_table(idx)
        pos_emb = self.position_embedding_table(torch.arange(T))
        x = tok_emb + pos_emb
        x = self.blocks(x)
        x = self.ln_f(x)
        logits = self.lm_head(x)

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
            idx_cond = idx[:, -self.block_size :]
            logits, loss = self(idx_cond)
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
block_size = 32
batch_size = 32
n_embd = 64
num_heads = 4
num_layers = 4
eval_iters = 200

print("decode test:", decode(itos, encode(stoi, text)) == text)
model = BigramLanguageModel(vocab_size, n_embd, block_size, num_heads, num_layers)
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
x, y = get_batch(train_data, batch_size, block_size)
logits, loss = model(x, y)


# training loop
el_before = estimate_loss(
    model, {"train": train_data, "val": val_data}, batch_size, block_size, eval_iters
)
print("estimate_loss before training", el_before)
print("loss before training", loss.item())
for i in range(10000):
    x, y = get_batch(train_data, batch_size, block_size)
    logits, loss = model(x, y)
    optimizer.zero_grad(set_to_none=True)
    loss.backward()
    optimizer.step()
print("loss after training", loss.item())
el_after = estimate_loss(
    model, {"train": train_data, "val": val_data}, batch_size, block_size, eval_iters
)
print("estimate_loss after training", el_after)


# generate
idx = torch.zeros((1, 1), dtype=torch.long)
generated = model.generate(idx, 300)
decoded = decode(itos, generated[0].tolist())
print("generated:", decoded)
