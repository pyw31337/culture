
import re

def check_balance(filename):
    with open(filename, 'r') as f:
        lines = f.readlines()
    
    stack = []
    
    for i, line in enumerate(lines):
        line_num = i + 1
        for char in line:
            if char in '({[':
                stack.append((char, line_num))
            elif char in ')}]':
                if not stack:
                    print(f"Error: Unexpected closing {char} at line {line_num}")
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
        print("Success: All braces/parens balanced.")

check_balance('src/components/PerformanceList.tsx')
