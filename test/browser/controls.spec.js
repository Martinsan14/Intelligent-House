const {test,expect}=require('@playwright/test');
test('phone controls, filtering and locked main power',async({page})=>{
 await page.goto('/');await expect(page.getByText('You’re exploring demo mode')).toBeVisible();
 await expect(page.getByRole('switch')).toHaveCount(18);
 const light=page.getByRole('switch',{name:'Living room Reading lamp',exact:true});
 await light.click();await expect(light).toHaveAttribute('aria-checked','true');
 await page.getByRole('button',{name:'All lights on',exact:false}).click();
 await expect(page.locator('#on-count')).toHaveText('18');
 await page.getByRole('button',{name:'Kitchen',exact:true}).click();await expect(page.getByRole('switch')).toHaveCount(3);
 await page.getByRole('button',{name:'All lights off',exact:false}).click();await expect(page.locator('#on-count')).toHaveText('0');
 await expect(page.locator('#main-power')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
