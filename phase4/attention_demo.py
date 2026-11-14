import torch
import torch.nn.functional as F
import torch.nn as nn


torch.manual_seed(1337)
B, T, C = 4, 8, 32
head_size = 16

key = nn.Linear(C, head_size, bias=False)
query = nn.Linear(C, head_size, bias=False)
value = nn.Linear(C, head_size, bias=False)
x = torch.randn(B, T, C)
tril = torch.tril(torch.ones(T, T))

k = key(x)
q = query(x)
v = value(x)

wei = q @ k.transpose(-2, -1)
wei = wei.masked_fill(tril == 0, float("-inf"))
wei = F.softmax(wei, dim=-1)
out = wei @ v


print("wei shape", wei.shape)
print("wei[0]", wei[0])
print("out shape", out.shape)

# xbow = torch.zeros(B, T, C)
# for b in range(B):
#     for t in range(T):
#         xslice = x[b, 0 : t + 1]
#         xbow[b, t] = xslice.mean(0)


# wei = torch.tril(torch.ones(T, T))
# wei = wei / wei.sum(1, keepdim=True)
# xbow2 = wei @ x
# tril = torch.tril(torch.ones(T, T))
# wei = torch.zeros(T, T)
# wei = wei.masked_fill(tril == 0, float("-inf"))
# wei = F.softmax(wei, dim=-1)
# xbow3 = wei @ x


# print("x[0]", x[0])
# print("xbow[0]", xbow[0])
# print("wei", wei)
# print("allclose2", torch.allclose(xbow, xbow2, atol=1e-6))
# print("allclose3", torch.allclose(xbow, xbow3, atol=1e-6))
