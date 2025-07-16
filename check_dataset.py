from datasets import load_from_disk

dataset = load_from_disk("hf_skin_dataset")
print(dataset)
print(dataset[0])