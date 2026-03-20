
import re

def check_balance_smart(filename, start_line=1):
    with open(filename, 'r') as f:
        text = f.read()
    
    # Remove strings
    text = re.sub(r"'[^']*'", "''", text)
    text = re.sub(r'"[^"]*"', '""', text)
    text = re.sub(r"`[^`]*`", "``", text)
    # Remove comments
    text = re.sub(r"//.*", "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    
    stack = []
    lines = text.split('\n')
    
    for i, line in enumerate(lines):
        line_num = i + 1
        if line_num < start_line:
            continue

        for char in line:
            if char in '({[':
                stack.append((char, line_num))
            elif char in ')}]':
                if not stack:
                    print(f"Error: Unexpected closing {char} at line {line_num}. Content: {line.strip()}")
                    return
                
                last, last_line = stack.pop()
                if (last == '(' and char != ')') or \
                   (last == '{' and char != '}') or \
                   (last == '[' and char != ']'):
                    print(f"Error: Mismatched {char} at line {line_num}. Expected matching closing for {last} from line {last_line}")
                    return

    if stack:
        first_unclosed = stack[0]
        print(f"Error: Unclosed {first_unclosed[0]} from line {first_unclosed[1]}")
    else:
        print("Success: Balanced.")

check_balance_smart('src/components/PerformanceList.tsx')
