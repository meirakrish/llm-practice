import torch


torch.manual_seed(1337)
B, T, C = 4, 8, 2
x = torch.randn(B, T, C)

xbow = torch.zeros(B, T, C)

for b in range(B):
    for t in range(T):
        xslice = x[b, 0 : t + 1]
        xbow[b, t] = xslice.mean(0)


wei = torch.tril(torch.ones(T, T))
wei = wei / wei.sum(1, keepdim=True)
xbow2 = wei @ x

print("x[0]", x[0])
print("xbow[0]", xbow[0])
print("wei", wei)
print("allclose", torch.allclose(xbow, xbow2, atol=1e-6))
