/**
 * Crypto Prize - 一键打赏功能
 * 目标：
 * 1. 最终输出一段纯js 代码（不是 typescript），启动函数
 * 2. 点击后弹出evm 钱包得转账界面
 * 3. 默认amount 为 0.001 eth
 * 4. 如果没有 evm 钱包，则弹出一个安装列表
 */

// 主流钱包安装链接
const WALLET_INSTALL_LINKS = {
  'MetaMask': 'https://metamask.io/download/',
  'Coinbase Wallet': 'https://www.coinbase.com/wallet',
  'Trust Wallet': 'https://trustwallet.com/download',
  'Rainbow': 'https://rainbow.me/',
  'Rabby': 'https://rabby.io/',
  'TokenPocket': 'https://tokenpocket.pro/',
  'imToken': 'https://token.im/',
  'OKX Wallet': 'https://www.okx.com/web3',
  'Phantom': 'https://phantom.app/',
  'Brave Wallet': 'https://brave.com/wallet/',
};

/**
 * 检测是否有 EVM 钱包
 */
function detectEVMWallet() {
  if (typeof window === 'undefined') return null;

  // 检测 window.ethereum (EIP-1193 标准)
  if (window.ethereum) {
    return window.ethereum;
  }

  // 检测其他常见钱包注入
  if (window.web3 && window.web3.currentProvider) {
    return window.web3.currentProvider;
  }

  return null;
}

/**
 * 显示钱包安装提示
 */
function showWalletInstallDialog() {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    padding: 30px;
    border-radius: 12px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
  `;

  const title = document.createElement('h2');
  title.textContent = '请安装 EVM 钱包';
  title.style.cssText = 'margin: 0 0 20px 0; font-size: 24px; font-weight: bold;';

  const desc = document.createElement('p');
  desc.textContent = '要使用此功能，您需要安装一个支持 EVM 的钱包扩展程序：';
  desc.style.cssText = 'margin: 0 0 20px 0; color: #666;';

  const walletList = document.createElement('div');
  walletList.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

  Object.entries(WALLET_INSTALL_LINKS).forEach(([name, url]) => {
    const walletItem = document.createElement('a');
    walletItem.href = url;
    walletItem.target = '_blank';
    walletItem.rel = 'noopener noreferrer';
    walletItem.textContent = `安装 ${name}`;
    walletItem.style.cssText = `
      display: block;
      padding: 12px 20px;
      background: #f0f0f0;
      border-radius: 8px;
      text-decoration: none;
      color: #333;
      font-weight: 500;
      transition: background 0.2s;
    `;
    walletItem.onmouseover = () => walletItem.style.background = '#e0e0e0';
    walletItem.onmouseout = () => walletItem.style.background = '#f0f0f0';
    walletList.appendChild(walletItem);
  });

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '关闭';
  closeBtn.style.cssText = `
    margin-top: 20px;
    padding: 10px 20px;
    background: #333;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
    width: 100%;
  `;
  closeBtn.onclick = () => document.body.removeChild(dialog);

  content.appendChild(title);
  content.appendChild(desc);
  content.appendChild(walletList);
  content.appendChild(closeBtn);
  dialog.appendChild(content);
  document.body.appendChild(dialog);

  // 点击背景关闭
  dialog.onclick = (e) => {
    if (e.target === dialog) {
      document.body.removeChild(dialog);
    }
  };
}

/**
 * 将 ETH 数量转换为 Wei（ETH 是 18 位小数）
 */
function parseETH(amount) {
  // 将 ETH 转换为 Wei: 1 ETH = 10^18 Wei
  const amountFloat = parseFloat(amount);
  if (isNaN(amountFloat) || amountFloat <= 0) {
    throw new Error('金额必须大于 0');
  }

  // 转换为字符串，处理小数
  const amountStr = amountFloat.toString();
  const parts = amountStr.split('.');
  const integerPart = parts[0] || '0';
  const decimalPart = (parts[1] || '').padEnd(18, '0').slice(0, 18);

  // 组合成完整的 wei 字符串
  const weiStr = integerPart + decimalPart;

  // 转换为十六进制
  const wei = BigInt(weiStr);
  return '0x' + wei.toString(16);
}

/**
 * 切换到指定链
 */
async function switchToChain(provider, targetChainId = 1) {
  try {
    // 获取当前链 ID
    const currentChainIdHex = await provider.request({ method: 'eth_chainId' });
    const currentChainId = parseInt(currentChainIdHex, 16);

    // 如果已经是目标链，直接返回
    if (currentChainId === targetChainId) {
      return { success: true, message: '已在目标链上' };
    }

    // 尝试切换链
    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + targetChainId.toString(16) }]
      });
      return { success: true, message: '链切换成功' };
    } catch (switchError) {
      // 如果链不存在，尝试添加链（仅对 Ethereum Mainnet）
      if (switchError.code === 4902 && targetChainId === 1) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x1',
              chainName: 'Ethereum Mainnet',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18
              },
              rpcUrls: ['https://mainnet.infura.io/v3/'],
              blockExplorerUrls: ['https://etherscan.io']
            }]
          });
          return { success: true, message: '链添加并切换成功' };
        } catch (addError) {
          throw new Error('无法添加 Ethereum Mainnet，请手动添加');
        }
      } else {
        throw switchError;
      }
    }
  } catch (error) {
    console.error('Switch chain error:', error);
    return {
      success: false,
      error: error.message || '切换链失败',
      message: error.message || '切换链失败，请重试'
    };
  }
}

/**
 * 发起 ETH 转账
 */
async function sendETHTransfer(provider, toAddress, amount = '0.001') {
  try {
    // 1. 获取当前账户
    const accounts = await provider.request({ method: 'eth_requestAccounts' });
    if (!accounts || accounts?.length === 0) {
      throw new Error('请先连接钱包');
    }

    const fromAddress = accounts[0];

    // 2. 切换到 Ethereum Mainnet (chainId = 1)
    const switchResult = await switchToChain(provider, 1);
    if (!switchResult.success) {
      throw new Error(switchResult.message || '切换链失败');
    }

    // 3. 验证并规范化接收地址
    let normalizedToAddress = toAddress;
    if (!normalizedToAddress.startsWith('0x')) {
      normalizedToAddress = '0x' + normalizedToAddress;
    }
    normalizedToAddress = normalizedToAddress.toLowerCase();

    if (normalizedToAddress.length !== 42) {
      throw new Error('接收地址格式不正确，地址长度应为 42 个字符（包含 0x）');
    }

    // 4. 转换金额为 Wei
    const amountInWei = parseETH(amount);

    // 5. 获取 gas price（如果失败，使用默认值）
    let gasPrice;
    try {
      gasPrice = await provider.request({ method: 'eth_gasPrice' });
    } catch (gasPriceError) {
      console.warn('获取 Gas Price 失败，使用默认值:', gasPriceError);
      // 使用默认 gas price: 20 Gwei (0x4a817c800 = 20000000000 wei)
      gasPrice = '0x4a817c800';
    }

    // 6. 估算 gas limit（如果失败，使用默认值）
    let gasLimit;
    try {
      // MetaMask 的 eth_estimateGas 参数格式：只需要 to 和 value
      const estimatedGas = await provider.request({
        method: 'eth_estimateGas',
        params: [{
          to: normalizedToAddress,
          value: amountInWei
        }]
      });
      // 增加 20% 的 gas 缓冲
      const gasLimitNum = parseInt(estimatedGas, 16);
      gasLimit = '0x' + Math.floor(gasLimitNum * 1.2).toString(16);
    } catch (estimateError) {
      console.warn('Gas 估算失败，使用默认值:', estimateError);
      // ETH 转账的标准 gas limit 约为 21000
      gasLimit = '0x' + (21000).toString(16);
    }

    // 7. 构建交易（直接转账 ETH，不需要 data 字段）
    const transaction = {
      from: fromAddress,
      to: normalizedToAddress,
      value: amountInWei,
      gas: gasLimit,
      gasPrice: gasPrice,
    };

    // 9. 发送交易（会弹出钱包确认界面）
    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [transaction]
    });

    return {
      success: true,
      txHash: txHash,
      message: `交易已提交！交易哈希: ${txHash}`
    };

  } catch (error) {
    console.error('Transfer error:', error);

    // 处理特定错误
    let errorMessage = '转账失败，请重试';

    if (error.code === -32002) {
      errorMessage = 'RPC 端点错误，请稍后重试或切换网络。\n如果问题持续，请尝试：\n1. 刷新页面\n2. 切换钱包网络\n3. 检查网络连接';
    } else if (error.code === -32000 && error.message && error.message.includes('INVALID')) {
      errorMessage = '交易执行失败，可能的原因：\n1. ETH 余额不足\n2. Gas 费用不足\n3. 接收地址无效\n请检查后重试';
    } else if (error.code === 4001) {
      errorMessage = '用户拒绝了交易请求';
    } else if (error.code === -32603) {
      errorMessage = '交易执行失败，请检查余额和地址是否正确';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      success: false,
      error: error.message || '转账失败',
      message: errorMessage
    };
  }
}

/**
 * 主函数：打赏功能
 * @param {string} evmWalletAddress - 接收地址（必填）
 * @param {number|string} amount - ETH 数量，默认 0.001
 */
function prizeMeCropt(evmWalletAddress, amount = '0.001') {
  // 参数验证
  if (!evmWalletAddress || typeof evmWalletAddress !== 'string') {
    console.error('错误：请提供有效的 EVM 钱包地址');
    alert('错误：请提供有效的 EVM 钱包地址');
    return;
  }

  // 检测钱包
  const provider = detectEVMWallet();

  if (!provider) {
    // 没有检测到钱包，显示安装提示
    showWalletInstallDialog();
    return;
  }

  // 有钱包，发起转账
  sendETHTransfer(provider, evmWalletAddress, amount)
    .then(result => {
      if (result.success) {
        alert(result.message);
        console.log('转账成功:', result.txHash);
      } else {
        alert('转账失败: ' + result.message);
        console.error('转账失败:', result.error);
      }
    })
    .catch(error => {
      alert('转账失败: ' + (error.message || '未知错误'));
      console.error('转账异常:', error);
    });
}

// 导出函数（如果使用模块系统）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = prizeMeCropt;
}
